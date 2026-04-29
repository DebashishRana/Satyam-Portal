import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { tenderService, bidderService } from '../services/api';
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Users,
  Gavel
} from 'lucide-react';

interface DashboardStats {
  totalTenders: number;
  activeTenders: number;
  completedEvaluations: number;
  pendingReviews: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalTenders: 12,
    activeTenders: 5,
    completedEvaluations: 8,
    pendingReviews: 3
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isOfficer = user?.role === 'committee_member' || user?.role === 'approver' || user?.role === 'admin';

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Load data based on role
        if (isOfficer) {
          // Load officer dashboard data
          const tenders = await tenderService.getAll();
          setStats(prev => ({
            ...prev,
            totalTenders: tenders?.length || 12,
            activeTenders: tenders?.filter((t: any) => t.status === 'published')?.length || 5
          }));
        } else {
          // Load bidder dashboard data
          const submissions = await bidderService.getMySubmissions();
          setStats(prev => ({
            ...prev,
            totalTenders: submissions?.submissions?.length || 3,
            completedEvaluations: submissions?.submissions?.filter((s: any) => s.status === 'accepted')?.length || 1
          }));
        }

        // Mock recent activity
        setRecentActivity([
          { id: 1, action: 'Tender published', description: 'Supply of Security Equipment - CRPF/2024/001', time: '2 hours ago', type: 'tender' },
          { id: 2, action: 'Bid submitted', description: 'IT Infrastructure Upgrade', time: '5 hours ago', type: 'bid' },
          { id: 3, action: 'Evaluation completed', description: 'Vehicle Procurement Tender', time: '1 day ago', type: 'evaluation' },
          { id: 4, action: 'Clarification requested', description: 'GST Certificate verification needed', time: '1 day ago', type: 'clarification' },
        ]);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [isOfficer]);

  const statCards = [
    { 
      title: isOfficer ? 'Total Tenders' : 'My Submissions', 
      value: stats.totalTenders, 
      icon: FileText, 
      color: 'primary',
      trend: '+12%' 
    },
    { 
      title: isOfficer ? 'Active Tenders' : 'Under Review', 
      value: stats.activeTenders, 
      icon: Clock, 
      color: 'warning',
      trend: '+5%' 
    },
    { 
      title: isOfficer ? 'Completed Evaluations' : 'Accepted Bids', 
      value: stats.completedEvaluations, 
      icon: CheckCircle, 
      color: 'success',
      trend: '+8%' 
    },
    { 
      title: isOfficer ? 'Pending Reviews' : 'Clarifications Needed', 
      value: stats.pendingReviews, 
      icon: AlertCircle, 
      color: 'danger',
      trend: '-2%' 
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {user?.full_name || user?.email}
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-IN', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const colorClasses = {
            primary: 'bg-primary-50 text-primary-600',
            success: 'bg-success-50 text-success-600',
            warning: 'bg-warning-50 text-warning-600',
            danger: 'bg-danger-50 text-danger-600',
          }[stat.color];

          return (
            <div key={index} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  <div className="flex items-center mt-2 text-sm">
                    <TrendingUp size={16} className="text-success-600 mr-1" />
                    <span className="text-success-600 font-medium">{stat.trend}</span>
                    <span className="text-gray-500 ml-1">vs last month</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${colorClasses}`}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className={`p-2 rounded-full ${
                  activity.type === 'tender' ? 'bg-primary-100 text-primary-600' :
                  activity.type === 'bid' ? 'bg-success-100 text-success-600' :
                  activity.type === 'evaluation' ? 'bg-warning-100 text-warning-600' :
                  'bg-danger-100 text-danger-600'
                }`}>
                  {activity.type === 'tender' ? <FileText size={16} /> :
                   activity.type === 'bid' ? <CheckCircle size={16} /> :
                   activity.type === 'evaluation' ? <Gavel size={16} /> :
                   <AlertCircle size={16} />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{activity.action}</p>
                  <p className="text-sm text-gray-600">{activity.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {isOfficer ? (
              <>
                <a href="/tenders" className="flex items-center p-3 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors">
                  <FileText className="text-primary-600 mr-3" size={20} />
                  <span className="font-medium text-primary-900">Create New Tender</span>
                </a>
                <a href="/evaluation/sample-tender-id" className="flex items-center p-3 bg-success-50 rounded-lg hover:bg-success-100 transition-colors">
                  <Gavel className="text-success-600 mr-3" size={20} />
                  <span className="font-medium text-success-900">Review Pending Evaluations</span>
                </a>
                <a href="/upload" className="flex items-center p-3 bg-warning-50 rounded-lg hover:bg-warning-100 transition-colors">
                  <Users className="text-warning-600 mr-3" size={20} />
                  <span className="font-medium text-warning-900">Upload Tender Documents</span>
                </a>
              </>
            ) : (
              <>
                <a href="/tenders" className="flex items-center p-3 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors">
                  <FileText className="text-primary-600 mr-3" size={20} />
                  <span className="font-medium text-primary-900">Browse Open Tenders</span>
                </a>
                <a href="/my-submissions" className="flex items-center p-3 bg-success-50 rounded-lg hover:bg-success-100 transition-colors">
                  <CheckCircle className="text-success-600 mr-3" size={20} />
                  <span className="font-medium text-success-900">View My Submissions</span>
                </a>
                <a href="/upload" className="flex items-center p-3 bg-warning-50 rounded-lg hover:bg-warning-100 transition-colors">
                  <Clock className="text-warning-600 mr-3" size={20} />
                  <span className="font-medium text-warning-900">Upload Compliance Docs</span>
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
