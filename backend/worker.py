"""Demo OCR worker showing async offloading from the main API."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict

logger = logging.getLogger("ocr_worker")
JOB_QUEUE: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()


async def submit_job(document_id: str, bidder_id: str, tender_id: str) -> Dict[str, str]:
    job = {
        "document_id": document_id,
        "bidder_id": bidder_id,
        "tender_id": tender_id,
    }
    await JOB_QUEUE.put(job)
    logger.info("Queued OCR job document_id=%s bidder_id=%s", document_id, bidder_id)
    return {"status": "queued", "document_id": document_id}


async def process_job(job: Dict[str, Any]) -> None:
    document_id = job["document_id"]
    logger.info("Starting OCR for document_id=%s", document_id)

    await asyncio.sleep(0.5)
    logger.info("OCR completed for document_id=%s", document_id)

    await asyncio.sleep(0.3)
    logger.info("Fact extraction completed for document_id=%s", document_id)

    await asyncio.sleep(0.2)
    logger.info(
        "Triggered eligibility evaluation for bidder_id=%s tender_id=%s",
        job["bidder_id"],
        job["tender_id"],
    )

    logger.info("Finished pipeline for document_id=%s", document_id)


async def worker_loop() -> None:
    while True:
        job = await JOB_QUEUE.get()
        try:
            await process_job(job)
        finally:
            JOB_QUEUE.task_done()


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    worker = asyncio.create_task(worker_loop())
    await submit_job("DOC-101", "BID-22", "TENDER-7")
    await JOB_QUEUE.join()
    worker.cancel()


if __name__ == "__main__":
    asyncio.run(main())
