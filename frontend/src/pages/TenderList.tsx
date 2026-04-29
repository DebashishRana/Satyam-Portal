import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tenderService } from '../services/api';
import { FileText, Calendar, DollarSign, ChevronRight } from 'lucide-react';

const TenderList: React.FC = () => {
  const [tenders, setTenders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTenders = async () => {
      try {
        const data = await tenderService.getAll();
        setTenders(data || []);
      } catch (error) {
        console.error('Failed to load tenders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTenders();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tenders</h1>
      </div>

      <div className="grid gap-6">
        {tenders.map((tender) => (
          <Link
            key={tender.id}
            to={`/tenders/${tender.id}`}
            className="card hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="text-primary-600" size={20} />
                  <span className="text-sm text-gray-500">{tender.reference_number}</span>
                  <span className={`status-badge ${
                    tender.status === 'published' ? 'status-pass' :
                    tender.status === 'draft' ? 'status-pending' :
                    'status-review'
                  }`}>
                    {tender.status}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{tender.title}</h3>
                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  {tender.category && (
                    <span className="capitalize">{tender.category}</span>
                  )}
                  {tender.estimated_value && (
                    <span className="flex items-center">
                      <DollarSign size={14} className="mr-1" />
                      {tender.estimated_value} {tender.currency || 'INR'}
                    </span>
                  )}
                  {tender.closing_date && (
                    <span className="flex items-center">
                      <Calendar size={14} className="mr-1" />
                      Closes: {new Date(tender.closing_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="text-gray-400" size={24} />
            </div>
          </Link>
        ))}

        {tenders.length === 0 && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tenders found</h3>
            <p className="text-gray-600">Tenders will appear here once they are created and published.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenderList;
