"""
Task Queue Service for Async Processing
"""

import logging
from typing import Optional
import asyncio

from app.services.bidder_pipeline import pipeline_service

logger = logging.getLogger(__name__)

class TaskQueue:
    """Async task queue for background processing."""
    
    def __init__(self):
        self.queue = asyncio.Queue()
        self.workers = []
        self.is_running = False
    
    async def start(self, num_workers: int = 3):
        """Start the task queue workers."""
        self.is_running = True
        for i in range(num_workers):
            worker = asyncio.create_task(self._worker(f"worker-{i}"))
            self.workers.append(worker)
        logger.info(f"Started {num_workers} task queue workers")
    
    async def stop(self):
        """Stop the task queue."""
        self.is_running = False
        for worker in self.workers:
            worker.cancel()
        self.workers = []
        logger.info("Task queue stopped")
    
    async def enqueue(self, task: dict):
        """Add a task to the queue."""
        await self.queue.put(task)
        logger.debug(f"Enqueued task: {task.get('type', 'unknown')}")
    
    async def _worker(self, worker_id: str):
        """Worker process that executes tasks."""
        while self.is_running:
            try:
                task = await asyncio.wait_for(self.queue.get(), timeout=1.0)
                await self._process_task(task)
                self.queue.task_done()
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}")
    
    async def _process_task(self, task: dict):
        """Process a single task."""
        task_type = task.get("type")
        
        if task_type == "document_uploaded":
            await self._process_document_uploaded_task(task)
        elif task_type == "ocr":
            await self._process_ocr_task(task)
        elif task_type == "ocr_completed":
            await self._process_ocr_completed_task(task)
        elif task_type == "facts_extracted":
            await self._process_facts_extracted_task(task)
        elif task_type == "evaluation":
            await self._process_evaluation_task(task)
        elif task_type == "verification":
            await self._process_verification_task(task)
        else:
            logger.warning(f"Unknown task type: {task_type}")

    async def _process_document_uploaded_task(self, task: dict):
        document_id = task.get("document_id")
        logger.info(f"Triggering OCR pipeline for uploaded document: {document_id}")
        await pipeline_service.process_document(document_id)

    async def _process_ocr_completed_task(self, task: dict):
        document_id = task.get("document_id")
        logger.info(f"Triggering fact extraction for document: {document_id}")
        await pipeline_service.process_document_facts(document_id)

    async def _process_facts_extracted_task(self, task: dict):
        tender_id = task.get("tender_id")
        bidder_id = task.get("bidder_id")
        logger.info(f"Triggering evaluation for tender: {tender_id}, bidder: {bidder_id}")
        await pipeline_service.evaluate_bidder(tender_id, bidder_id)
    
    async def _process_ocr_task(self, task: dict):
        """Process OCR task."""
        document_id = task.get("document_id")
        logger.info(f"Processing OCR for document: {document_id}")
        
        # Simulate processing time
        await asyncio.sleep(2)
        
        logger.info(f"OCR completed for document: {document_id}")
    
    async def _process_evaluation_task(self, task: dict):
        """Process evaluation task."""
        tender_id = task.get("tender_id")
        bidder_id = task.get("bidder_id")
        logger.info(f"Processing evaluation for tender: {tender_id}, bidder: {bidder_id}")
        
        # Simulate processing time
        await asyncio.sleep(3)
        
        logger.info(f"Evaluation completed for tender: {tender_id}, bidder: {bidder_id}")
    
    async def _process_verification_task(self, task: dict):
        """Process external verification task."""
        document_type = task.get("document_type")
        document_id = task.get("document_id")
        logger.info(f"Processing verification for {document_type}: {document_id}")
        
        # Simulate API call
        await asyncio.sleep(1)
        
        logger.info(f"Verification completed for {document_type}: {document_id}")

# Global queue instance
queue_instance: Optional[TaskQueue] = None

async def init_queue():
    """Initialize the task queue."""
    global queue_instance
    queue_instance = TaskQueue()
    await queue_instance.start()

async def get_queue() -> TaskQueue:
    """Get the task queue instance."""
    if queue_instance is None:
        await init_queue()
    return queue_instance

async def enqueue_task(task_type: str, **kwargs):
    """Enqueue a task for async processing."""
    queue = await get_queue()
    task = {"type": task_type, **kwargs}
    await queue.enqueue(task)
