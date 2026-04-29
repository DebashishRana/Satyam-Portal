import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { evaluationService, tenderService } from '../services/api';
import { CheckCircle, XCircle, AlertCircle, Gavel, FileText, ChevronRight } from 'lucide-react';

const EvaluationConsole: React.FC = () => {
  const { tenderId } = useParams<{ tenderId: string }>();
  const [tender, setTender] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!tenderId) return;
      try {
        const [tenderData, comparisonData] = await Promise.all([
          tenderService.getById(tenderId),
          evaluationService.getComparison(tenderId).catch(() => null),
        ]);
        setTender(tenderData);
        if (comparisonData?.bidders) {
          setEvaluations(comparisonData.bidders);
        }
      } catch (error) {
        console.error('Failed to load evaluation data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [tenderId]);

  const runEvaluation = async (bidderId: string) => {
    if (!tenderId) return;
    try {
      const result = await evaluationService.evaluateBidder(tenderId, bidderId);
      // Refresh the list
      const comparisonData = await evaluationService.getComparison(tenderId);
      setEvaluations(comparisonData.bidders);
    } catch (error) {
      console.error('Evaluation failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Evaluation Console</h1>
        <p className="text-gray-600">{tender?.title}</p>
      </div>

      {/* Comparison Matrix */}
      <div className="card overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Bidder Comparison Matrix</h2>
        
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-900">Bidder</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-900">Overall</th>
              <th className="text-center py-3 px-4 font-semibold text-success-600">Passed</th>
              <th className="text-center py-3 px-4 font-semibold text-danger-600">Failed</th>
              <th className="text-center py-3 px-4 font-semibold text-warning-600">Review</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((evaluation, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div className="flex items-center">
                    <FileText className="text-gray-400 mr-2" size={16} />
                    <span className="font-medium">{evaluation.bidder_id}</span>
                  </div>
                </td>
                <td className="text-center py-3 px-4">
                  <span className={`status-badge ${
                    evaluation.overall_result === 'PASS' ? 'status-pass' :
                    evaluation.overall_result === 'FAIL' ? 'status-fail' :
                    'status-review'
                  }`}>
                    {evaluation.overall_result}
                  </span>
                </td>
                <td className="text-center py-3 px-4 text-success-600 font-semibold">
                  {evaluation.criteria_breakdown?.passed || 0}
                </td>
                <td className="text-center py-3 px-4 text-danger-600 font-semibold">
                  {evaluation.criteria_breakdown?.failed || 0}
                </td>
                <td className="text-center py-3 px-4 text-warning-600 font-semibold">
                  {evaluation.criteria_breakdown?.review || 0}
                </td>
                <td className="text-right py-3 px-4">
                  <button
                    onClick={() => runEvaluation(evaluation.bidder_id)}
                    className="text-primary-600 hover:text-primary-700 flex items-center ml-auto"
                  >
                    <Gavel size={16} className="mr-1" />
                    Run Evaluation
                  </button>
                </td>
              </tr>
            ))}
            
            {evaluations.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No evaluations yet. Run evaluation on submitted bids.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center space-x-6 text-sm">
        <div className="flex items-center">
          <CheckCircle className="text-success-600 mr-1" size={16} />
          <span>Pass</span>
        </div>
        <div className="flex items-center">
          <XCircle className="text-danger-600 mr-1" size={16} />
          <span>Fail</span>
        </div>
        <div className="flex items-center">
          <AlertCircle className="text-warning-600 mr-1" size={16} />
          <span>Needs Review</span>
        </div>
      </div>
    </div>
  );
};

export default EvaluationConsole;
