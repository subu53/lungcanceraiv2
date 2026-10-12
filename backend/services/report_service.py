"""
PDF Report Generation Service using ReportLab.
Generates professional diagnostic reports for lung cancer classification cases.
"""

import os
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image as RLImage,
)
from reportlab.graphics.shapes import Drawing, Rect, String

from ..config import settings


REPORTS_DIR = os.path.join(settings.UPLOAD_DIR, "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)


def _get_class_color(classification: str) -> tuple:
    """Map classification to display name and color."""
    if "Normal" in classification:
        return "Normal", colors.Color(0.18, 0.80, 0.44)
    elif "Benign" in classification:
        return "Benign", colors.Color(1.0, 0.76, 0.03)
    elif "Malignant" in classification:
        return "Malignant", colors.Color(0.90, 0.22, 0.21)
    return classification, colors.Color(0.58, 0.65, 0.72)


def _draw_probability_chart(probabilities: dict) -> Drawing:
    """Create a bar chart of classification probabilities."""
    width = 450
    chart_height = 120
    d = Drawing(width, chart_height + 40)

    d.add(String(0, chart_height + 20, "Classification Probabilities",
                 fontSize=11, fontName="Helvetica-Bold", fillColor=colors.HexColor("#1e293b")))

    if not probabilities:
        return d

    items = sorted(probabilities.items(), key=lambda x: -x[1])
    n = len(items)
    bar_width = min(120, (width - 40) / n - 20)
    max_prob = max(v for _, v in items)
    scale = chart_height / max(max_prob, 0.01)

    for i, (cls_name, prob) in enumerate(items):
        x = 30 + i * (bar_width + 30)
        h = prob * scale
        display_name, col = _get_class_color(cls_name)

        bar = Rect(x, 0, bar_width, h, fillColor=col, strokeColor=None)
        d.add(bar)

        label = String(x + bar_width / 2, h + 3, f"{prob * 100:.1f}%",
                       fontSize=9, fontName="Helvetica-Bold", textAnchor="middle",
                       fillColor=colors.HexColor("#334155"))
        d.add(label)

        name_label = String(x + bar_width / 2, -14, display_name,
                            fontSize=8, fontName="Helvetica", textAnchor="middle",
                            fillColor=colors.HexColor("#64748b"))
        d.add(name_label)

    return d


def generate_pdf_report(
    case_id: int,
    patient_id: str,
    classification: str,
    confidence: float,
    probabilities: dict,
    interpretation_text: str,
    gradcam_path: str = None,
    review_status: str = "pending",
    review_notes: str = None,
    reviewer_name: str = None,
) -> str:
    """Generate a PDF diagnostic report and return the file path."""
    filename = f"case_{case_id}_report.pdf"
    filepath = os.path.join(REPORTS_DIR, filename)

    doc = SimpleDocTemplate(
        filepath, pagesize=A4,
        topMargin=30 * mm, bottomMargin=20 * mm,
        leftMargin=20 * mm, rightMargin=20 * mm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle", parent=styles["Heading1"],
        fontSize=20, textColor=colors.HexColor("#1e293b"),
        spaceAfter=6, fontName="Helvetica-Bold",
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle", parent=styles["Normal"],
        fontSize=10, textColor=colors.HexColor("#64748b"), spaceAfter=16,
    )
    heading_style = ParagraphStyle(
        "SectionHeading", parent=styles["Heading2"],
        fontSize=14, textColor=colors.HexColor("#1e293b"),
        spaceBefore=16, spaceAfter=8, fontName="Helvetica-Bold",
    )
    body_style = ParagraphStyle(
        "ReportBody", parent=styles["Normal"],
        fontSize=10, textColor=colors.HexColor("#334155"), leading=14,
    )
    note_style = ParagraphStyle(
        "ReportNote", parent=styles["Normal"],
        fontSize=8, textColor=colors.HexColor("#94a3b8"),
        leading=11, fontName="Helvetica-Oblique",
    )

    elements = []

    # === HEADER ===
    elements.append(Paragraph("Lung Cancer AI Classification Report", title_style))
    elements.append(Paragraph(
        f"Generated on {datetime.now().strftime('%B %d, %Y at %H:%M')} &bull; "
        f"AI-Powered Clinical Decision Support", subtitle_style
    ))
    elements.append(HRFlowable(
        width="100%", thickness=2, color=colors.HexColor("#3b82f6"),
        spaceBefore=0, spaceAfter=16,
    ))

    # === PATIENT INFO ===
    elements.append(Paragraph("Patient Information", heading_style))
    display_class, class_color = _get_class_color(classification)
    info_data = [
        ["Case ID", f"#{case_id}"],
        ["Patient ID", patient_id],
        ["Report Date", datetime.now().strftime("%Y-%m-%d")],
        ["Classification", display_class],
        ["Confidence", f"{confidence * 100:.1f}%"],
        ["Review Status", review_status.upper()],
    ]
    info_table = Table(info_data, colWidths=[120, 350])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#64748b")),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#1e293b")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 12))

    # === PROBABILITY CHART ===
    if probabilities:
        elements.append(Paragraph("Classification Results", heading_style))
        chart = _draw_probability_chart(probabilities)
        elements.append(chart)
        elements.append(Spacer(1, 24))

    # === PROBABILITY TABLE ===
    if probabilities:
        table_data = [["Classification", "Probability", "Percentage"]]
        for cls_name, prob in sorted(probabilities.items(), key=lambda x: -x[1]):
            display, _ = _get_class_color(cls_name)
            table_data.append([display, f"{prob:.4f}", f"{prob * 100:.1f}%"])

        prob_table = Table(table_data, colWidths=[150, 120, 120])
        prob_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3b82f6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#334155")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ]))
        elements.append(prob_table)
    elements.append(Spacer(1, 12))

    # === GRAD-CAM ===
    if gradcam_path and os.path.exists(gradcam_path):
        elements.append(Paragraph("Grad-CAM Attention Heatmap", heading_style))
        elements.append(Paragraph(
            "The heatmap below highlights the regions of the CT image that the AI model "
            "focused on when making its classification decision.", body_style
        ))
        elements.append(Spacer(1, 8))
        elements.append(RLImage(gradcam_path, width=200, height=200))
        elements.append(Spacer(1, 12))

    # === INTERPRETATION ===
    elements.append(Paragraph("AI Interpretation", heading_style))
    for line in interpretation_text.split("\n"):
        line = line.strip()
        if line:
            line = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            if line.startswith("===") or line.startswith("---"):
                elements.append(HRFlowable(
                    width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"),
                    spaceBefore=4, spaceAfter=4,
                ))
            elif line.startswith("CLASSIFICATION") or line.startswith("FINDING") or line.startswith("RECOMMENDATION"):
                elements.append(Paragraph(f"<b>{line}</b>", body_style))
            else:
                elements.append(Paragraph(line, body_style))
    elements.append(Spacer(1, 12))

    # === REVIEW ===
    if review_notes or reviewer_name:
        elements.append(Paragraph("Radiologist Review", heading_style))
        if reviewer_name:
            elements.append(Paragraph(f"<b>Reviewed by:</b> {reviewer_name}", body_style))
        if review_notes:
            elements.append(Paragraph(f"<b>Notes:</b> {review_notes}", body_style))
        elements.append(Spacer(1, 12))

    # === DISCLAIMER ===
    elements.append(HRFlowable(
        width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"),
        spaceBefore=16, spaceAfter=8,
    ))
    elements.append(Paragraph(
        "DISCLAIMER: This report is generated by an AI-powered classification system using EfficientNet-B0. "
        "It is intended to assist medical professionals in clinical decision-making and should not be used "
        "as the sole basis for diagnosis. Always consult with qualified healthcare providers for medical decisions.",
        note_style,
    ))
    elements.append(Paragraph(
        f"Lung Cancer AI Classification System &bull; Report ID: LCAI-{case_id:05d} &bull; "
        f"Confidential Medical Document",
        note_style,
    ))

    doc.build(elements)
    return filepath
