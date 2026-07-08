import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import '../styles/EscalationAnalytics.css';
import { 
  TrendingUp, Clock, AlertTriangle, CheckCircle, 
  ArrowRight, ShieldAlert, BarChart3, PieChart, RefreshCw
} from 'lucide-react';

// ChartJS imports
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title as ChartTitle 
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, ChartTitle);

const EscalationAnalytics = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tickets', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setComplaints(result.data);
      } else {
        addToast('Error', result.message || 'Failed to fetch complaints', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchComplaints();
    }
  }, [user]);

  // Aggregate stats in frontend memory
  const totalTickets = complaints.length;
  const escalatedTickets = complaints.filter(c => (c.currentEscalationLevel || 0) > 0 || c.isEscalated);
  const totalEscalated = escalatedTickets.length;
  const autoEscalated = escalatedTickets.filter(c => c.isAutoEscalated).length;
  const manualEscalated = totalEscalated - autoEscalated;
  
  // SLA Compliance Rate: Percentage of tickets that did NOT require auto-escalation
  const slaCompliance = totalTickets > 0 
    ? (((totalTickets - autoEscalated) / totalTickets) * 100).toFixed(1)
    : '100';

  // 1. Chart Data: Escalated tickets by department
  const deptCounts = {};
  escalatedTickets.forEach(c => {
    const dept = c.department?.name || (c.assignedTo && typeof c.assignedTo === 'object' ? c.assignedTo.department : c.assignedTo) || 'Unassigned';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });
  
  const deptLabels = Object.keys(deptCounts);
  const deptData = Object.values(deptCounts);

  const departmentChartData = {
    labels: deptLabels,
    datasets: [
      {
        label: 'Tickets Escalated to Department',
        data: deptData,
        backgroundColor: 'rgba(99, 102, 241, 0.65)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 1.5,
        borderRadius: 6
      }
    ]
  };

  const departmentChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#64748b', stepSize: 1 }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#64748b' }
      }
    }
  };

  // 2. Chart Data: Escalated tickets by category
  const catCounts = {};
  escalatedTickets.forEach(c => {
    const cat = c.categoryName || 'General';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  const catLabels = Object.keys(catCounts);
  const catData = Object.values(catCounts);

  const baseColors = [
    'rgba(99, 102, 241, 0.7)', // Indigo
    'rgba(168, 85, 247, 0.7)', // Purple
    'rgba(236, 72, 153, 0.7)', // Pink
    'rgba(244, 63, 94, 0.7)',  // Rose
    'rgba(34, 211, 238, 0.7)', // Cyan
    'rgba(52, 211, 153, 0.7)', // Emerald
    'rgba(245, 158, 11, 0.7)', // Amber
    'rgba(59, 130, 246, 0.7)', // Blue
    'rgba(239, 68, 68, 0.7)',  // Red
    'rgba(20, 184, 166, 0.7)', // Teal
    'rgba(249, 115, 22, 0.7)', // Orange
    'rgba(132, 204, 22, 0.7)'  // Lime
  ];

  const catColors = catLabels.map((_, index) => baseColors[index % baseColors.length]);

  const categoryChartData = {
    labels: catLabels,
    datasets: [
      {
        label: 'Escalations',
        data: catData,
        backgroundColor: catColors,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1
      }
    ]
  };

  const categoryChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#94a3b8',
          font: { family: 'Plus Jakarta Sans', size: 11 }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1
      }
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp className="text-accent" size={26} />
            Escalation Engine Analytics
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            Real-time tracking of SLA breach frequencies, manual overflows, and department distribution.
          </p>
        </div>
        <button
          onClick={fetchComplaints}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh Data
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
          <RefreshCw className="animate-spin text-accent" size={32} />
        </div>
      ) : (
        <>
          {/* Key Metric Cards */}
          <div className="stats-grid">
            
            {/* Total Escalated */}
            <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#f87171' }}>
                <ShieldAlert size={24} />
              </div>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Escalated</span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '2px 0 0 0' }}>{totalEscalated}</h3>
              </div>
            </div>

            {/* Auto Escalated */}
            <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fbbf24' }}>
                <Clock size={24} />
              </div>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Automated SLA Breaches</span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '2px 0 0 0' }}>{autoEscalated}</h3>
              </div>
            </div>

            {/* Manually Escalated */}
            <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#818cf8' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Manual Overrides</span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '2px 0 0 0' }}>{manualEscalated}</h3>
              </div>
            </div>

            {/* SLA Compliance */}
            <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#34d399' }}>
                <CheckCircle size={24} />
              </div>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>SLA Compliance Rate</span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '2px 0 0 0' }}>{slaCompliance}%</h3>
              </div>
            </div>

          </div>

          {/* Charts Row */}
          <div className="dashboard-grid" style={{ marginBottom: '32px' }}>
            
            {/* Department Bar Chart */}
            <div className="card" style={{ padding: '24px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={18} className="text-accent" />
                Escalations Received by Department
              </h3>
              <div style={{ height: '300px', position: 'relative' }}>
                {deptLabels.length === 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                    No escalation data recorded yet.
                  </div>
                ) : (
                  <Bar data={departmentChartData} options={departmentChartOptions} />
                )}
              </div>
            </div>

            {/* Category Doughnut Chart */}
            <div className="card" style={{ padding: '24px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieChart size={18} className="text-accent" />
                Escalation Share by Category
              </h3>
              <div style={{ height: '300px', position: 'relative' }}>
                {catLabels.length === 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                    No category escalation records.
                  </div>
                ) : (
                  <Doughnut data={categoryChartData} options={categoryChartOptions} />
                )}
              </div>
            </div>

          </div>

          {/* Recent Escalations Table Grid */}
          <div className="card" style={{ padding: '24px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Recent Escalated Complaints</h3>
            
            {escalatedTickets.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0', margin: 0 }}>
                No active complaints are currently escalated.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>ID</th>
                      <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Title</th>
                      <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Category</th>
                      <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Assigned Dept</th>
                      <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Level</th>
                      <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Trigger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escalatedTickets.slice(0, 10).map((ticket) => (
                      <tr key={ticket._id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: 800, color: 'var(--accent-color)' }}>
                          {ticket.trackingId}
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: 600 }}>
                          {ticket.title}
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {ticket.categoryName}
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: 700 }}>
                          {ticket.department?.name || (ticket.assignedTo && typeof ticket.assignedTo === 'object' ? ticket.assignedTo.department : ticket.assignedTo) || 'Unassigned'}
                        </td>
                        <td style={{ padding: '14px 8px' }}>
                          <span style={{ 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            fontSize: '11px', 
                            fontWeight: 800, 
                            backgroundColor: 'rgba(99, 102, 241, 0.15)',
                            color: 'var(--accent-color)' 
                          }}>
                            Lvl {ticket.currentEscalationLevel || 1}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px' }}>
                          <span style={{ 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            backgroundColor: ticket.isAutoEscalated ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            color: ticket.isAutoEscalated ? '#fbbf24' : '#34d399' 
                          }}>
                            {ticket.isAutoEscalated ? 'Auto (SLA)' : 'Manual'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
};

export default EscalationAnalytics;
