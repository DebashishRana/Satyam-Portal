<div align="center">

# 🔐 Satyam Portal

**AI-Driven Tender Evaluation & Transparency Platform for Government Procurement**

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED.svg)](https://docker.com)
[![License](https://img.shields.io/badge/License-GPL--3.0-green.svg)](LICENSE)

[Overview](#overview) • [Features](#features) • [Architecture](#architecture) • [Quick Start](#quick-start) • [Documentation](#documentation)

</div>

---

## 📋 Overview

**Satyam Portal** transforms today's **28-day, fully manual tender evaluation cycle** into a deterministic, evidence-backed workflow that officers can defend in audit and bidders can trust.

### Current Problem Reality
- Committees manually scrutinize **hundreds of pages per bidder** (scanned balance sheets, photos of certificates, complex tables)
- **No structured decision system** for enforcing technical, financial and compliance rules
- **High wrongful rejections** over minor paperwork issues and ambiguous scans
- **Insider-tailored tenders** reduce competition and inflate L1 prices by 15-25%
- **18-36 month litigation delays** when disqualified bidders challenge opaque decisions

### Satyam Solution
Satyam implements a **6-layer Digital Trust Architecture**:
1. **User Layer** - Bidder & Officer portals with guided workflows
2. **Intelligence Layer** - AI-powered OCR + data extraction
3. **Verification Layer** - Cross-validation via government APIs (DigiLocker, GSTN, MCA)
4. **Trust Layer** - Cryptographic validation + reusable credentials
5. **Consent & Control Layer** - Purpose-based, revocable access aligned with data protection laws
6. **Integration Layer** - API connectivity with CPPP/GeM and multi-department portals

---

## ✨ Features

### 🔍 Tender Insight Engine (TIE)
- **Document Understanding**: Multi-page tender PDF processing with LayoutLMv3
- **Criteria Extraction**: Automatic extraction of Condition-Threshold-Penalty triplets
- **Risk Detection**: Flags contradictory clauses and ambiguous requirements

### 📝 Bidder Evidence Miner (BEM)
- **OCR Ensemble**: Bhashini/AI4Bharat for Indic scripts + high-accuracy Latin OCR
- **Table Extraction**: Financial data extraction from balance sheets
- **Entity Recognition**: GSTIN, PAN, CIN, dates, amounts validation
- **Document Authentication**: QR code, stamp, and signature detection

### ⚖️ Deterministic Evaluation Engine
- **Rule-Based Matching**: 100% auditable, explainable decision logic (PyRete-style)
- **Human-in-the-Loop**: No-silent-rejection policy - all ambiguous cases routed to human review
- **Verification Cards**: Per-criterion evidence with file, page, and bounding box citations
- **Audit Trail**: Every decision logged with who/when/why for CAG compliance

### 🎯 Officer Portal Features
- **Tender Summary**: AI-extracted eligibility schema grouped by category
- **Bidders Comparison**: Matrix view of all bidders vs criteria (Pass/Fail/Review)
- **One-Click Reports**: Draft Reasoned Order and Evaluation Report generation
- **Conflict Flags**: Automatic detection of insider-risk patterns

### 👤 Bidder Portal Features
- **Pizza-Tracker Status**: Visual progress through evaluation stages
- **Guided Uploads**: Checklist-based document submission with format validation
- **Clarification Tickets**: No silent rejections - transparent communication
- **Outcome Transparency**: Per-criterion explanations with evidence links

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SATYAM PORTAL ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │ Bidder       │      │ Officer      │      │ Auditor      │  │
│  │ Portal       │      │ Console      │      │ Dashboard    │  │
│  │ (React + TS) │      │ (React + TS) │      │ (React + TS) │  │
│  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘  │
│         │                     │                     │           │
│         └─────────────────────┼─────────────────────┘           │
│                               │                                 │
│              ┌────────────────┴────────────────┐               │
│              │      FastAPI (Python)           │               │
│              │  ┌─────────┐  ┌─────────┐       │               │
│              │  │ Auth    │  │ Tender  │       │               │
│              │  │ Service │  │ Service │       │               │
│              │  └─────────┘  └─────────┘       │               │
│              │  ┌─────────┐  ┌─────────┐       │               │
│              │  │Document │  │Eval     │       │               │
│              │  │Service  │  │Service  │       │               │
│              │  └─────────┘  └─────────┘       │               │
│              └────────────────┬────────────────┘               │
│                               │                                 │
│         ┌─────────────────────┼─────────────────────┐           │
│         │                     │                     │           │
│  ┌──────┴──────┐      ┌──────┴──────┐      ┌──────┴──────┐     │
│  │    TIE      │      │    BEM      │      │   Matcher   │     │
│  │ (LayoutLM   │      │  (OCR +     │      │  (Rule      │     │
│  │  + LLM)     │      │  Entity     │      │  Engine)    │     │
│  └─────────────┘      │  Extract)   │      └─────────────┘     │
│                       └─────────────┘                          │
│                               │                                 │
│              ┌────────────────┴────────────────┐               │
│              │           Data Layer            │               │
│              │  ┌─────────┐  ┌─────────┐       │               │
│              │  │PostgreSQL      │  │  Redis  │       │               │
│              │  │(Primary DB)     │  │ (Queue) │       │               │
│              │  └─────────┘  └─────────┘       │               │
│              │  ┌─────────┐  ┌─────────┐       │               │
│              │  │Milvus/  │  │  S3/    │       │               │
│              │  │PGVector │  │MinIO    │       │               │
│              │  │(Vectors)│  │(Files)  │       │               │
│              │  └─────────┘  └─────────┘       │               │
│              └─────────────────────────────────┘               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript 5, Tailwind CSS, Lucide Icons |
| **Backend** | FastAPI (Python), Uvicorn, SQLAlchemy 2.0 |
| **Database** | PostgreSQL 15, Redis 7, Milvus/PGVector |
| **AI/ML** | LayoutLMv3, Tesseract OCR, OpenAI/Hathi LLM |
| **DevOps** | Docker, Docker Compose, Nginx |
| **External APIs** | DigiLocker, GSTN, MCA, CPPP/GeM |

---

## 🚀 Quick Start

### Prerequisites
- Docker 20.10+ and Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/satyam-portal.git
cd satyam-portal

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/docs
# Backend API: http://localhost:8000
```

### Option 2: Local Development

#### Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start

# Access at http://localhost:3000
```

### Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| Officer | `officer1@crpf.gov.in` | `password123` |
| Bidder | `bidder1@example.com` | `password123` |

---

## 📚 Documentation

### API Documentation
Once the server is running, access interactive API documentation:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/login` | User authentication |
| `GET /api/v1/tenders/` | List all tenders |
| `POST /api/v1/tenders/` | Create new tender |
| `POST /api/v1/documents/upload` | Upload document |
| `POST /api/v1/bidders/{tender_id}/submit` | Submit bid |
| `POST /api/v1/evaluation/{tender_id}/evaluate/{bidder_id}` | Run evaluation |

### Project Structure
```
satyam-portal/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/    # API routes
│   │   ├── core/                 # Config, database, security
│   │   ├── models/               # Database models
│   │   ├── schemas/              # Pydantic schemas
│   │   └── services/             # Business logic
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/           # Reusable components
│   │   ├── contexts/             # Auth context
│   │   ├── pages/                # Page components
│   │   └── services/             # API services
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 🔐 Security & Compliance

### Data Protection
- **Encryption**: TLS 1.3 everywhere, AES-256 at rest
- **Access Control**: RBAC with fine-grained permissions
- **Audit Logging**: Full audit trail for all data access
- **Data Residency**: Deployable on MeghRaj/GCC for data sovereignty

### Government Compliance
- **GFR 2017**: Compliant with General Financial Rules
- **CVC Guidelines**: Vigilance and integrity measures
- **CAG Audit**: Audit-ready documentation structure
- **Digital India**: Integrates with DigiLocker, NIC SSO

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Integration Tests
```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **CRPF/MHA** for the problem statement and domain expertise
- **Bhashini/AI4Bharat** for Indic language OCR support
- **FastAPI** and **React** communities for excellent tooling

---

<div align="center">

**Built with ❤️ for transparent and accountable government procurement**

[⬆ Back to Top](#-satyam-portal)

</div>
