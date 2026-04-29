import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { bidderService } from '../services/api';
import { CheckCircle, Clock, FileText, AlertCircle } from 'lucide-react';

const SubmissionStatus: React.FC = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStatus = async () => {
      if (!submissionId) return;
      try {
        const data = await bidderService.getSubmissionStatus(submissionId);
        setStatus(data);
      } catch (error) {
        console.error('Failed to load status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStatus();
    
    // Poll every 30 seconds
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, [submissionId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-danger-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Submission not found</h3>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Submission Status</h1>

      {/* Pizza Tracker */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-gray-500">Submission ID</p>
            <p className="font-mono font-semibold">{submissionId}</p>
          </div>
          <span className={`status-badge ${
            status.overall_status === 'accepted' ? 'status-pass' :
            status.overall_status === 'rejected' ? 'status-fail' :
            'status-review'
          }`}>
            {status.overall_status?.toUpperCase()}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 transition-all duration-500"
              style={{ width: `${status.stage_percentage || 0}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {status.stage_percentage}% Complete - {status.current_stage}
          </p>
        </div>

        {/* Stage Timeline */}
        <div className="space-y-4">
          {status.stages?.map((stage: any, index: number) => (
            <div key={index} className="flex items-start space-x-4">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                stage.completed ? 'bg-success-100 text-success-600' :
                stage.status === 'in_progress' ? 'bg-primary-100 text-primary-600' :
                'bg-gray-100 text-gray-400'
              }`}>
                {stage.completed ? (
                  <CheckCircle size={16} />
                ) : stage.status === 'in_progress' ? (
                  <Clock size={16} />
                ) : (
                  <FileText size={16} />
                )}
              </div>
              <div className="flex-1">
                <p className={`font-medium ${
                  stage.completed ? 'text-gray-900' :
                  stage.status === 'in_progress' ? 'text-primary-900' :
                  'text-gray-500'
                }`}>
                  {stage.name}
                </p>
                {stage.date && (
                  <p className="text-sm text-gray-500">{stage.date}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clarification Section */}
      {status.evaluation_status === 'clarification_requested' && (
        <div className="card border-warning-500 border-2">
          <div className="flex items-start space-x-3">
            <AlertCircle className="text-warning-600 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-warning-900">Clarification Required</h3>
              <p className="text-warning-700 mt-1">
                The evaluation committee has requested additional information.
                Please respond before the deadline to avoid disqualification.
              </p>
              <button className="mt-4 btn-warning">
                Respond to Clarification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionStatus;
