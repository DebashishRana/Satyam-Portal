import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tenderService } from '../services/api';
import { FileText, Calendar, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';

const TenderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tender, setTender] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTender = async () => {
      if (!id) return;
      try {
        const data = await tenderService.getById(id);
        setTender(data);
      } catch (error) {
        console.error('Failed to load tender:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTender();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!tender) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-danger-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Tender not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-gray-500">{tender.reference_number}</span>
          <h1 className="text-2xl font-bold text-gray-900">{tender.title}</h1>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => navigate(`/submit-bid/${id}`)}
            className="btn-primary"
          >
            Submit Bid
          </button>
          <button
            onClick={() => navigate(`/evaluation/${id}`)}
            className="btn-secondary"
          >
            Evaluate
          </button>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <span className="text-sm text-gray-500">Status</span>
            <span className={`status-badge block w-fit mt-1 ${
              tender.status === 'published' ? 'status-pass' :
              tender.status === 'draft' ? 'status-pending' :
              'status-review'
            }`}>
              {tender.status}
            </span>
          </div>
          <div>
            <span className="text-sm text-gray-500">Estimated Value</span>
            <p className="font-medium">{tender.estimated_value} {tender.currency || 'INR'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Closing Date</span>
            <p className="font-medium">{tender.closing_date ? new Date(tender.closing_date).toLocaleDateString() : 'Not set'}</p>
          </div>
        </div>

        {tender.description && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-600">{tender.description}</p>
          </div>
        )}

        {tender.eligibility_criteria && tender.eligibility_criteria.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Eligibility Criteria</h3>
            <div className="space-y-3">
              {tender.eligibility_criteria.map((criteria: any, index: number) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <CheckCircle className="text-success-600 mt-0.5" size={18} />
                  <div>
                    <p className="font-medium text-gray-900">{criteria.description}</p>
                    <span className="text-sm text-gray-500 capitalize">{criteria.category}</span>
                    {criteria.mandatory && (
                      <span className="ml-2 text-xs bg-danger-100 text-danger-800 px-2 py-0.5 rounded">Mandatory</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenderDetail;
