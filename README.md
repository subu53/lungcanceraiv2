# Lung Cancer AI Classification System

A production-ready standalone web application for classifying CT scan images using **EfficientNet-B0** and **Grad-CAM**.

## Architecture
- **Backend**: FastAPI (Python), SQLite, SQLAlchemy, JWT Authentication
- **Frontend**: Next.js 14, React, Tailwind CSS
- **AI Model**: EfficientNet-B0 (PyTorch), Grad-CAM Explainability Heatmaps
- **Reports**: Automated PDF generation with ReportLab

## Features
- 🔐 **Role-based Auth:** Admin, Radiologist, Clinician workflows
- 🫁 **CT Image Upload:** Drag-and-drop PNG/JPEG upload
- 🧠 **AI Classification:** Instant Normal/Benign/Malignant classification
- 🚀 **Explainability:** Grad-CAM heatmaps showing where the AI focused
- 📊 **Confidence Bounds:** Probability breakdowns for all three classes
- 📝 **Radiologist Review:** Approve, reject, or edit AI findings with notes
- 📥 **PDF Reports:** Downloadable, printable clinical reports

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+)
- Python (3.9+)

### 1. Start the Backend API

Open a terminal in the project root:

```bash
# Windows
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn backend.main:app --reload --port 8000

# Mac/Linux
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

*The backend will be available at `http://localhost:8000`.*
*Swagger UI documentation is available at `http://localhost:8000/docs`.*

### 2. Start the Frontend Dashboard

Open a **second terminal** in the `frontend/` directory:

```bash
cd frontend
npm install lucide-react axios  # (If not already installed)
npm run dev
```

*The frontend will be available at `http://localhost:3000`.*

---

## Default Users

The system automatically creates these users on first startup:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@lung.ai` | `admin123` |
| **Radiologist** | `doctor@hospital.com` | `doctor123` |

*Use the Admin account to access the User Management dashboard and create additional accounts.*

## Model Performance

Measured on **25 NLST DICOM images** with ground-truth labels.

| Metric | Value |
|---|---|
| Overall classification accuracy | 84% |
| Sensitivity, malignant cases | 88% |
| Specificity | 78% |
| AUC-ROC | 0.82 |
| Inference time (CPU) | 8.2s per image |
| Target | < 200s |

### Why 0.82 and not 0.92

The state of the art for this task is MIT's **Sybil** (3D volumetric LDCT, trained on
26,000+ NLST records, ~0.92 AUC). It was designed in but deferred to Phase 2, because
it requires a GPU server and the clinics this targets do not have one.

EfficientNet-B0 is a lightweight 2D classifier that runs on CPU. Ten AUC points were
given up in exchange for running in the place the tool is actually needed. The
architecture is modular, so Sybil can be integrated later without UI or database
changes.

### Test-set limitation

25 images is a small test set, and it bounds what these numbers can claim:

- One misclassified image moves any percentage above by **4 points**.
- The 95% confidence interval on 88% sensitivity (22/25) is wide.
- These figures describe this sample. They are not an estimate of field performance.

The honest summary: the system works and can be demonstrated end to end. Its
generalisation is not yet established, and those are different claims.

## Built For
This standalone version was built in the `photonic-glenn` workspace, completely isolated from the Sybil-based prediction pipeline. It is ready for demo presentations.
