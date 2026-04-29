# Satyam Portal - Submission Document

## 1. Overview & Problem Statement

**Satyam Portal** is an AI-driven tender evaluation and transparency platform designed for CRPF and similar government procurement bodies. It transforms today's **28-day, fully manual evaluation cycle** into a deterministic, evidence-backed workflow that officers can defend in audit and bidders can trust.

### Current Problem Reality
- Committees manually scrutinize **hundreds of pages per bidder** (scanned balance sheets, photos of certificates, complex tables)
- **No structured decision system** for enforcing technical, financial and compliance rules
- **High wrongful rejections** over minor paperwork issues and ambiguous scans
- **Insider-tailored tenders** reduce competition and inflate L1 prices by 15-25%
- **18-36 month litigation delays** when disqualified bidders challenge opaque decisions

> **Note:** A detailed case paper covering problem analysis, metrics, and legal context (GFR/CVC/CAG) has already been prepared. This submission focuses on the technical design and implementation.

---

## 2. Technical Architecture & Stack

Satyam is designed as a **modular, containerized system** deployable on MeghRaj / Government Community Cloud with five major planes:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Experience Layer** | React + TypeScript, Tailwind CSS | Bidder & Officer Portals |
| **API Layer** | Python FastAPI (async), NGINX/NIC WAF | Backend services & orchestration |
| **AI/ML Layer** | LayoutLMv3, OpenHathi/Llama3, PyRete | Document understanding & matching |
| **Data Layer** | PostgreSQL, Milvus/PGVector, MeghRaj S3 | Storage, vectors, object storage |
| **DevOps Layer** | Docker, Kubernetes, GitHub Actions | CI/CD, security, observability |

### 2.1 Key Components

#### Tender Insight Engine (TIE)
- **OCR & Layout:** Bhashini/AI4Bharat for Indic scripts + NemotronOCR/Textract for English
- **Classification:** LLM (OpenHathi/Llama3) segments into Eligibility, Technical, Financial, GCC, SCC
- **Extraction:** Clause classifier (fine-tuned BERT/IndicBERT) labels GST/PAN/MSME/Turnover/etc.
- **Output:** Machine-readable Eligibility Schema (JSON)

#### Bidder Evidence Miner (BEM)
- **Normalization:** OpenCV deskew, denoise, binarize, page tiling
- **Table Extraction:** Table structure models for financial data
- **Entity Extraction:** NER for GSTIN, PAN, CIN, dates, amounts
- **Validation:** Domain-specific validators + authenticity signals

#### Deterministic Matcher & Risk Engine
- **Rule Engine:** PyRete/Drools-style engine using explicit rules
- **Output per Criterion:** PASS/FAIL/REVIEW with evidence citations
- **Risk Analytics:** Flags tender ambiguity and insider-risk patterns

### 2.2 Technical Parameters for Judgement

| Parameter | Implementation |
|-----------|---------------|
| **Feasibility** | Modular microservices, async processing, horizontal scaling |
| **Reusability** | Containerized components, model-agnostic design, API-first architecture |
| **Deployability** | Docker + Kubernetes on MeghRaj/GCC, NIC WAF integration, SSO-ready |
| **Scalability** | Redis + Celery/RabbitMQ queue, GPU/CPU cluster scaling |
| **Security** | TLS everywhere, RBAC, fine-grained permissions, full audit logs |
| **Observability** | ELK/OpenSearch, structured logs, processing metrics, alerting |

---

## 3. Demo & GitHub

**GitHub Repository:** [Link to be provided]

The repository contains:
- Core FastAPI services
- Simplified ML pipelines (mocked/light models for demo)
- React frontends for both bidder and officer portals
- Scripts to run the full flow in a sandbox with sample tender and bidder documents

**Demo Scope:** End-to-end workflow from tender upload → bid submission → AI evaluation → report generation, showcasing both portal views.

---

## 4. Functioning - Officer & Bidder Portals

### 4.1 Bidder Portal (Satyam - Vendor UI)

**Key Features:**
- Tender listing and search (CPPP/GeM feed)
- **Guided bid submission** with checklist of required documents
- **Document upload with inline OCR preview** - warns on low resolution
- **"Pizza-tracker" status:** Submitted → Preliminary Scrutiny → Technical Evaluation → Financial Evaluation → Final Outcome
- **Rejection view** with criterion-wise reasons and links to evidence

**Bidder Journey:**
1. Login via Satyam Portal or CPPP/GeM SSO
2. View human-readable eligibility criteria extracted by TIE
3. Upload documents with format/quality checks
4. Track live status with percentage completion
5. Receive clarification tickets (not silent rejections)
6. View outcome with per-criterion explanation and evidence links

### 4.2 Officer Portal (Satyam - Evaluation Console)

**Tech:** React + TypeScript, role-based routes (Committee Member, Approver, Auditor)

**Key Features:**
- **Tender Summary:** Extracted eligibility schema grouped by category
- **Bidders Comparison:** Matrix of bidders vs criteria (Pass/Fail/Review)
- **Verification Cards:** Per-criterion detail with evidence (file, page, bounding box, extracted value, logic)
- **Conflict & Risk Flags:** Contradictory clauses, insider-risk, low OCR confidence
- **One-click export:** Draft Reasoned Order and Evaluation Report (PDF/HTML)

**Officer Journey:**
1. Upload tender (or pull from CPPP/GeM)
2. TIE presents Eligibility Schema for review/edit
3. Bids trigger asynchronous evaluation pipeline
4. Dashboard shows all bidders: Green=PASS, Red=FAIL, Yellow=REVIEW
5. Click cell → open Verification Card with clause text and evidence
6. For REVIEW items: View scan area, mark PASS/FAIL with comment (logged)
7. Generate Draft Evaluation Report with citations ready for signature

### 4.3 Portal Interconnection

- **Single API & Data Layer:** Both portals share the same backend; no logic duplication
- **Status Synchronization:** Bidder's view is a filtered, safe subset of evaluation state
- **Clarification Flow:** Mediated by clarification table with full audit trail
- **Common Data:** Same tender documents, criteria, decisions, and audit logs

---

## 5. Edge Case Handling

### 5.1 Document Quality Issues
| Edge Case | Handling Strategy |
|-----------|-----------------|
| **Scanned documents & photos** | Preprocessing (deskew, denoise), OCR ensemble, low-confidence thresholding |
| **Poor quality scans** | Auto-marked as REVIEW (never FAIL), routed to human review |
| **Multilingual documents** | Bhashini/AI4Bharat OCR for Indic scripts + ensemble approach |

### 5.2 Content Ambiguity
| Edge Case | Handling Strategy |
|-----------|-----------------|
| **Ambiguous language** | Clause-similarity checks flag contradictions, marked for officer resolution |
| **Contradictory clauses** | TIE marks tender "Ambiguous", pushes resolution task before evaluation |
| **Partial information/missing pages** | BEM marks "Missing Evidence" (not FAIL), requires explicit officer decision |
| **Format inconsistency across bidders** | Fact table abstraction ensures like-for-like comparison regardless of layout |

### 5.3 Unit & Value Confusion
- **Lakhs vs Crores detection:** Modal-verb analysis + classifier
- **Threshold extraction:** Explicit Condition-Threshold-Penalty triplets
- **Value validation:** Range checks and format validators

---

## 6. APIs & External Connectors

### Current/Future Integrations
| API | Purpose |
|-----|---------|
| **DigiLocker API** | PAN, Aadhaar-linked document verification |
| **GSTN/GST Verification API** | GSTIN validity check |
| **MCA API/Data Dumps** | Company master data and financials |
| **CPPP/GeM Export/Import** | Tender and bid metadata exchange |
| **Bhashini/AI4Bharat** | Indic script OCR |

### Trust Layer (Dectra Integration)
- Connectors to DigiLocker, GSTN, MCA maintain trust graph
- Verified documents stored with hash and provenance
- Subsequent tenders minimize re-verification

---

## 7. Architecture Quality & Technology Justification

### 7.1 Architecture Strengths
- **Modular & Containerized:** Each service independently deployable and scalable
- **Model-Agnostic:** OCR/LLM components swappable as better options emerge
- **MeghRaj-Compatible:** Designed for Government Community Cloud deployment
- **API-First:** Enables future integrations and third-party access

### 7.2 Technology Choices Rationale
| Choice | Justification |
|--------|--------------|
| **FastAPI** | Async Python, high performance, automatic OpenAPI docs |
| **React + TypeScript** | Type safety, component reusability, modern UI patterns |
| **PostgreSQL** | ACID compliance, JSON support, proven at scale |
| **Vector DB (Milvus)** | Semantic search for clause similarity and precedent matching |
| **Redis + Celery** | Reliable async job processing, horizontal scaling |
| **LayoutLMv3** | State-of-the-art document layout understanding |
| **PyRete Rule Engine** | Deterministic, auditable, explainable decision logic |

### 7.3 Identified Risks & Trade-offs

| Risk | Mitigation Strategy |
|------|---------------------|
| **Model hallucination** | LLMs only for text structuring; numeric facts and Pass/Fail via rule engine + validated data |
| **OCR errors on poor scans** | Ensemble OCR + low-confidence routing to REVIEW + explicit officer sign-off |
| **Performance at scale** | Async processing; batch mode initially, near-real-time as resources permit |
| **Infrastructure load** | Horizontal scaling on MeghRaj; GPU/CPU cluster allocation |
| **Data privacy** | On-premise/GCC deployment option; encryption at rest and in transit |

---

## 8. Alignment to Evaluation Criteria

| Criteria | Weight | How Satyam Addresses It |
|----------|--------|------------------------|
| **Clarity of problem understanding** | 20% | Anchored in CRPF/MHA realities: 28-day cycles, 500-page bids, 20-30% value leakage, litigation delays. Case paper details metrics and legal context (GFR/CVC/CAG). |
| **Technical soundness** | 25% | Decomposed into TIE, BEM, Deterministic Matcher. State-of-the-art OCR + layout models; 100% rule-based criterion matching; explainable via Verification Cards. |
| **Depth on edge cases** | 25% | Explicit flows for low-quality scans, multilingual docs, contradictory clauses, partial info, unit ambiguities. No-Silent-Rejection policy with HITL pipeline. |
| **Human-in-the-loop & audit trail** | 15% | Ambiguous cases forced to REVIEW with reason; human overrides logged with who/when/why. Page + bbox citations for instant audit-readiness. |
| **Architecture quality & trade-offs** | 15% | Modular, containerized, MeghRaj-friendly, model-agnostic. Explicit risk calling (hallucination, OCR errors, infra load) with mitigation strategies. |

---

## 9. Human-in-the-Loop (HITL) & Audit Trail

### No-Silent-Rejection Policy
- Any decision based on ambiguous or low-confidence extraction → forced REVIEW
- Human click and justification required
- All actions logged with timestamp and user ID

### Audit Evidence Structure
Every PASS/FAIL/REVIEW tied to:
- Tender clause ID
- Bidder document ID
- Page number
- Bounding box coordinates
- Extracted text/value

**Result:** Instant audit-ready documentation meeting GFR/CAG expectations.

---

*End of Submission Document*
