import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bidderService } from '../services/api';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';

const BidSubmission: React.FC = () => {
  const { tenderId } = useParams<{ tenderId: string }>();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState({
    technical: [] as string[],
    financial: [] as string[],
    compliance: [] as string[],
    emd: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!tenderId) return;
    
    setIsSubmitting(true);
    try {
      const response = await bidderService.submitBid(tenderId, {
        technical_documents: documents.technical,
        financial_documents: documents.financial,
        compliance_documents: documents.compliance,
        emd_document: documents.emd,
      });
      
      setSubmissionId(response.submission_id);
      setSubmitted(true);
    } catch (error) {
      console.error('Submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted && submissionId) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="mx-auto h-16 w-16 text-success-600 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bid Submitted Successfully!</h2>
        <p className="text-gray-600 mb-6">Your submission has been received and is being processed.</p>
        <div className="card max-w-md mx-auto mb-6">
          <p className="text-sm text-gray-500 mb-1">Submission ID</p>
          <p className="font-mono font-semibold text-lg">{submissionId}</p>
        </div>
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => navigate(`/submission-status/${submissionId}`)}
            className="btn-primary"
          >
            Track Status
          </button>
          <button
            onClick={() => navigate('/tenders')}
            className="btn-secondary"
          >
            Browse More Tenders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Submit Bid</h1>

      <div className="card space-y-6">
        <div className="flex items-start space-x-3 p-4 bg-primary-50 rounded-lg">
          <AlertCircle className="text-primary-600 mt-0.5" size={20} />
          <div>
            <h3 className="font-medium text-primary-900">Document Requirements</h3>
            <p className="text-sm text-primary-700 mt-1">
              Please ensure all required documents are uploaded before submitting.
              Incomplete submissions may be rejected.
            </p>
          </div>
        </div>

        {/* Technical Documents */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Technical Documents (BOQ, Specifications)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
            <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">Click to upload technical documents</p>
          </div>
        </div>

        {/* Financial Documents */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Financial Documents (Price Bid, Cost Breakdown)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
            <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">Click to upload financial documents</p>
          </div>
        </div>

        {/* Compliance Documents */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Compliance Documents (GST, PAN, MSME, Experience Certificates)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
            <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">Click to upload compliance documents</p>
          </div>
        </div>

        {/* EMD */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Earnest Money Deposit (EMD)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
            <FileText className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">Upload EMD proof (Bank Guarantee/DD/Online Payment)</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                Submitting...
              </span>
            ) : (
              'Submit Bid'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BidSubmission;
