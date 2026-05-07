# Production Readiness Snippets Pack

## What this proves

These snippets show that the CRPF Satyam tender evaluation platform has been designed with production concerns in mind even in demo mode. They communicate separation of OCR workloads, Kubernetes deployment readiness, environment-based secret handling, restricted internal traffic, and traceable admin actions.

## Scalability demo story

Open [backend/worker.py](backend/worker.py) and explain that OCR is not executed inside the request-response path. The API would submit a job, and a separate worker would process OCR, fact extraction, and evaluation trigger asynchronously.

Then open [k8s/ocr-worker-deployment.yaml](k8s/ocr-worker-deployment.yaml) and [k8s/ocr-worker-hpa.yaml](k8s/ocr-worker-hpa.yaml) to show that workers have their own deployment, resource requests and limits, and can scale from 2 to 10 pods when CPU usage rises.

## Security demo story

Open [backend/security_config.py](backend/security_config.py) and point out that API keys, JWT secrets, and encryption keys are loaded only from environment variables. The safe summary masks secrets before display, which is useful in logs or admin diagnostics.

Then open [k8s/secrets-example.yaml](k8s/secrets-example.yaml) and [k8s/api-network-policy.yaml](k8s/api-network-policy.yaml) to show that secrets are injected from Kubernetes Secrets and that internal traffic can be limited so the evaluation API only talks to approved services.

## Auditability demo story

Open [backend/audit_log.py](backend/audit_log.py) and explain that every sensitive action can produce a structured event with UTC timestamp, user, action, entity type, entity id, and reason/details. That directly supports government procurement expectations around traceability for overrides, review actions, and clarification requests.

## Important note

These are demo snippets for jury presentation, not a full production platform.

A full production system would add real message queues, observability, IAM, mTLS, secret rotation, signed audit storage, and CI/CD security checks.
