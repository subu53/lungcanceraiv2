"""
CT Image Classification Service using EfficientNet-B0.
Classifies CT images as Normal / Benign / Malignant with Grad-CAM explainability.
"""

import os
import json
import uuid
import io
import base64
import numpy as np
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
from PIL import Image

import torch
import torch.nn as nn
from torchvision import models, transforms

from ..config import settings

# ── Globals ──────────────────────────────────────────────────
_model = None
_class_names = None
_device = None
_transform = None


def _get_transforms():
    return transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])


def load_model():
    """Load EfficientNet-B0 model and class names. Cached globally."""
    global _model, _class_names, _device, _transform

    if _model is not None:
        return _model, _class_names, _device

    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[ClassificationService] Loading EfficientNet-B0 on {_device}...")

    _model = models.efficientnet_b0(weights=None)
    in_features = _model.classifier[1].in_features
    _model.classifier[1] = nn.Linear(in_features, 3)

    weights_path = os.path.join(settings.MODEL_DIR, "efficientnet_lung_v1.pth")
    _model.load_state_dict(torch.load(weights_path, map_location=_device, weights_only=True))
    _model.to(_device)
    _model.eval()

    class_names_path = os.path.join(settings.MODEL_DIR, "class_names.json")
    with open(class_names_path, "r") as f:
        _class_names = json.load(f)

    _transform = _get_transforms()
    print(f"[ClassificationService] Model loaded. Classes: {_class_names}")
    return _model, _class_names, _device


def predict(image: Image.Image) -> dict:
    """
    Classify a CT image.
    Returns: {"classification": str, "confidence": float, "probabilities": dict}
    """
    model, class_names, device = load_model()
    tfm = _get_transforms()

    image_tensor = tfm(image.convert("RGB")).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(image_tensor)
        probs = torch.softmax(outputs, dim=1)
        pred_idx = torch.argmax(probs, dim=1).item()
        confidence = probs[0, pred_idx].item()

    pred_class = class_names[pred_idx]
    probabilities = {class_names[i]: round(probs[0, i].item(), 4) for i in range(len(class_names))}

    return {
        "classification": pred_class,
        "confidence": round(confidence, 4),
        "probabilities": probabilities,
        "pred_idx": pred_idx,
        "image_tensor": image_tensor,
    }


def generate_gradcam(image_tensor: torch.Tensor, pred_idx: int, case_id: int) -> str:
    """
    Generate Grad-CAM heatmap and save to disk.
    Returns: path to the saved heatmap image.
    """
    model, _, device = load_model()

    gradients = []
    activations = []

    target_layer = model.features[-1]

    def forward_hook(module, inp, out):
        activations.append(out)

    def backward_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0])

    fh = target_layer.register_forward_hook(forward_hook)
    bh = target_layer.register_full_backward_hook(backward_hook)

    # Need gradients for Grad-CAM
    image_tensor = image_tensor.clone().detach().requires_grad_(True).to(device)

    model.zero_grad()
    output = model(image_tensor)
    score = output[:, pred_idx]
    score.backward()

    fh.remove()
    bh.remove()

    grads = gradients[0]
    acts = activations[0]

    weights = torch.mean(grads, dim=(2, 3), keepdim=True)
    cam = torch.sum(weights * acts, dim=1).squeeze()
    cam = torch.relu(cam).detach().cpu().numpy()

    cam = cam - cam.min()
    cam = cam / (cam.max() + 1e-8)

    cam_img = Image.fromarray(np.uint8(cam * 255)).resize((224, 224))
    cam_arr = np.array(cam_img)

    fig, ax = plt.subplots(figsize=(4, 4), dpi=100)
    ax.imshow(cam_arr, cmap="jet")
    ax.axis("off")

    gradcam_dir = os.path.join(settings.UPLOAD_DIR, "gradcam")
    os.makedirs(gradcam_dir, exist_ok=True)
    filename = f"gradcam_case_{case_id}.png"
    filepath = os.path.join(gradcam_dir, filename)

    plt.savefig(filepath, format="png", bbox_inches="tight", pad_inches=0)
    plt.close(fig)

    return filepath


def generate_interpretation(classification: str, confidence: float, probabilities: dict) -> str:
    """Generate a clinical interpretation text based on classification results."""
    lines = []
    lines.append("=== AI-Powered CT Image Classification ===\n")

    # Clean class name for display
    display_class = classification.replace(" cases", "")
    lines.append(f"CLASSIFICATION: {display_class.upper()}")
    lines.append(f"Confidence: {confidence * 100:.1f}%\n")

    # Clinical recommendation based on class
    if "Normal" in classification:
        lines.append("FINDING: No abnormal lung tissue patterns detected.")
        lines.append("RECOMMENDATION: Routine follow-up. Continue standard screening schedule.")
        lines.append("The AI model has classified this CT image as showing normal lung tissue")
        lines.append("with no detectable nodules or masses.\n")
    elif "Benign" in classification:
        lines.append("FINDING: Benign lung tissue pattern detected.")
        lines.append("RECOMMENDATION: Enhanced monitoring. Schedule follow-up CT in 6-12 months.")
        lines.append("The AI model has detected patterns consistent with benign lung nodules.")
        lines.append("While not immediately concerning, regular monitoring is advised to")
        lines.append("track any changes over time.\n")
    elif "Malignant" in classification:
        lines.append("FINDING: Malignant tissue pattern detected.")
        lines.append("RECOMMENDATION: URGENT — Immediate specialist referral.")
        lines.append("The AI model has detected patterns consistent with malignant lung tissue.")
        lines.append("Immediate clinical evaluation and further diagnostic procedures")
        lines.append("(PET-CT, biopsy) are strongly recommended.\n")

    # Probability breakdown
    lines.append("--- Classification Probability Breakdown ---")
    for cls_name, prob in sorted(probabilities.items(), key=lambda x: -x[1]):
        display = cls_name.replace(" cases", "")
        pct = prob * 100
        bar = "█" * int(pct / 2) + "░" * (50 - int(pct / 2))
        lines.append(f"  {display:>10}: {pct:5.1f}%  {bar}")

    lines.append("\n" + "NOTE: This classification is generated by an EfficientNet-B0 AI model and")
    lines.append("is intended to assist clinical decision-making. It should not replace")
    lines.append("professional medical judgment. Always consult with qualified healthcare")
    lines.append("providers for diagnostic decisions.")

    return "\n".join(lines)
