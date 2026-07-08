import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Building2, 
  ChevronRight, 
  ChevronDown, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  RefreshCw,
  ArrowRight,
  Edit,
  Search,
  Plus,
  X,
  ShieldAlert,
  Users
} from 'lucide-react';

const getSlaFlag = (c) => {
  if (c.status === 'Resolved' || c.status === 'Closed' || c.status === 'Rejected') {
    return null;
  }
  
  // 1. Purple: Executive Escalated
  if (c.executiveEscalated) {
    return (
      <span className="badge" style={{ backgroundColor: '#a855f7', color: 'white', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <ShieldAlert size={10} />
        Exec Escalated
      </span>
    );
  }

  // 2. Dark Red: Repeated Breaches
  if (c.totalBreachCount > 1) {
    return (
      <span className="badge" style={{ backgroundColor: '#7f1d1d', color: 'white', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <AlertTriangle size={10} />
        Repeated Breach ({c.totalBreachCount})
      </span>
    );
  }

  // 3. Red: SLA Breached
  if (c.responseSlaStatus === 'Breached' || c.resolutionSlaStatus === 'Breached') {
    return (
      <span className="badge" style={{ backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <AlertTriangle size={10} />
        SLA Breached
      </span>
    );
  }

  // 4. Orange: Approaching Breach (Warning approaching due time or due in < 2 hours)
  const isApproaching = (() => {
    if (!c.nextEscalationDueAt) return false;
    const due = new Date(c.nextEscalationDueAt).getTime();
    const diffMs = due - Date.now();
    return diffMs > 0 && diffMs < 2 * 60 * 60 * 1000; // within 2 hours
  })();

  if (isApproaching) {
    return (
      <span className="badge" style={{ backgroundColor: '#f97316', color: 'white', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <Clock size={10} />
        Approaching Breach
      </span>
    );
  }

  // 5. Yellow: SLA Warning
  if (c.responseSlaStatus === 'Warning' || c.resolutionSlaStatus === 'Warning') {
    return (
      <span className="badge" style={{ backgroundColor: '#eab308', color: 'black', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <Clock size={10} />
        SLA Warning
      </span>
    );
  }

  return null;
};

const DepartmentDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Tabs State
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' or 'manage'

  // Audit Metrics State
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDept, setExpandedDept] = useState(null);

  // Departments List & Form State
  const [departmentsList, setDepartmentsList] = useState([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [isEditingDept, setIsEditingDept] = useState(false);
  const [editDeptId, setEditDeptId] = useState(null);
  const [deptFormName, setDeptFormName] = useState('');
  const [deptFormDesc, setDeptFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Decoupled Copy Category State
  const [categoriesList, setCategoriesList] = useState([]);
  const [selectedTemplates, setSelectedTemplates] = useState({});
  const [selectedGroups, setSelectedGroups] = useState({});
  const [groups, setGroups] = useState([]);
  const [expandedDeptCatsId, setExpandedDeptCatsId] = useState(null); // Collapsible categories manager

  // Search filter for departments
  const [deptSearchQuery, setDeptSearchQuery] = useState('');

  // Checkboxes for category copying on department creation
  const [selectedCategoriesToCopy, setSelectedCategoriesToCopy] = useState([]);

  const fetchAllComplaints = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tickets', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setComplaints(result.data);
      } else {
        addToast('Error', result.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to communicate with server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      setDeptLoading(true);
      const response = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setDepartmentsList(result.data);
      } else {
        addToast('Error', result.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to load departments list', 'error');
    } finally {
      setDeptLoading(false);
    }
  };

  const fetchCategoriesList = async () => {
    try {
      const response = await fetch('/api/categories', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setCategoriesList(result.data);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setGroups(result.data);
      }
    } catch (err) {
      console.error('Failed to load groups list', err);
    }
  };

  useEffect(() => {
    if (user?.token) {
      if (activeTab === 'audit') {
        fetchAllComplaints();
      } else {
        fetchDepartments();
        fetchCategoriesList();
        fetchGroups();
      }
    }
  }, [user, activeTab]);

  // Aggregate complaints by assigned department
  const deptsMap = {};
  complaints.forEach((c) => {
    const dept = c.assignedDepartment || 'General Administration';
    if (!deptsMap[dept]) {
      deptsMap[dept] = {
        name: dept,
        total: 0,
        pending: 0,
        active: 0,
        resolved: 0,
        rejected: 0,
        tickets: []
      };
    }
    
    deptsMap[dept].total += 1;
    deptsMap[dept].tickets.push(c);

    if (c.status === 'Pending') deptsMap[dept].pending += 1;
    else if (['Investigating', 'Assigned', 'On Hold'].includes(c.status)) deptsMap[dept].active += 1;
    else if (c.status === 'Resolved') deptsMap[dept].resolved += 1;
    else if (c.status === 'Rejected') deptsMap[dept].rejected += 1;
  });

  const departments = Object.values(deptsMap).sort((a, b) => b.total - a.total);

  const handleToggleExpand = (deptName) => {
    setExpandedDept(expandedDept === deptName ? null : deptName);
  };

  const getPriorityBadge = (priority) => {
    return <span className={`badge badge-priority-${priority.toLowerCase()}`}>{priority}</span>;
  };

  const getStatusBadge = (status) => {
    return <span className={`badge badge-status-${status.toLowerCase()}`}>{status}</span>;
  };

  // Department CRUD Handlers
  const handleEditDeptClick = (dept) => {
    setIsEditingDept(true);
    setEditDeptId(dept._id);
    setDeptFormName(dept.name);
    setDeptFormDesc(dept.description || '');
    setSelectedCategoriesToCopy([]);
  };

  const handleCancelEditDept = () => {
    setIsEditingDept(false);
    setEditDeptId(null);
    setDeptFormName('');
    setDeptFormDesc('');
    setSelectedCategoriesToCopy([]);
  };

  const handleCheckboxChange = (catName) => {
    if (selectedCategoriesToCopy.includes(catName)) {
      setSelectedCategoriesToCopy(selectedCategoriesToCopy.filter(name => name !== catName));
    } else {
      setSelectedCategoriesToCopy([...selectedCategoriesToCopy, catName]);
    }
  };

  const handleSubmitDept = async (e) => {
    e.preventDefault();
    if (!deptFormName.trim()) {
      addToast('Validation Error', 'Department name is required', 'error');
      return;
    }

    try {
      setSaving(true);
      const url = isEditingDept ? `/api/departments/${editDeptId}` : '/api/departments';
      const method = isEditingDept ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          name: deptFormName,
          description: deptFormDesc
        })
      });

      const result = await response.json();
      if (result.success) {
        const newDept = result.data;

        // If creating a new department, map selected category templates
        if (!isEditingDept && selectedCategoriesToCopy.length > 0) {
          await Promise.all(
            selectedCategoriesToCopy.map(async (catName) => {
              const template = categoriesList.find(c => c.name === catName);
              if (template) {
                await fetch(`/api/departments/${newDept._id}/categories/${template._id}`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${user.token}`
                  }
                });
              }
            })
          );
        }

        addToast('Success', isEditingDept ? 'Department updated successfully' : 'Department created successfully with categories', 'success');
        handleCancelEditDept();
        fetchDepartments();
        fetchCategoriesList();
      } else {
        addToast('Error', result.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to save department', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDeptActive = async (dept) => {
    try {
      const response = await fetch(`/api/departments/${dept._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          isActive: !dept.isActive
        })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Success', `Department ${!dept.isActive ? 'activated' : 'deactivated'} successfully`, 'success');
        fetchDepartments();
      } else {
        addToast('Error', result.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to update department status', 'error');
    }
  };

  // Map Category to Department
  const handleCopyCategoryTemplate = async (deptId) => {
    const templateName = selectedTemplates[deptId];
    if (!templateName) {
      addToast('Validation Error', 'Please select a category template to map', 'error');
      return;
    }

    const template = categoriesList.find(c => c.name === templateName);
    if (!template) return;

    // Set assignedGroup to null to route to all groups in department collectively
    const assignedGroup = null;

    try {
      setSaving(true);
      const response = await fetch(`/api/departments/${deptId}/categories/${template._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ assignedGroup })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Success', `Category "${template.name}" mapped to department successfully`, 'success');
        setSelectedTemplates({ ...selectedTemplates, [deptId]: '' });
        fetchDepartments();
        fetchCategoriesList();
      } else {
        addToast('Error', result.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to map category template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCategory = async (deptId, catId, catName) => {
    if (!window.confirm(`Are you sure you want to remove "${catName}" from this department? Citizens will no longer be able to file new tickets under this category.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/departments/${deptId}/categories/${catId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        addToast('Success', `Category "${catName}" removed from department successfully`, 'success');
        fetchDepartments();
        fetchCategoriesList();
      } else {
        addToast('Error', result.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to remove category', 'error');
    }
  };

  // Get distinct templates (Global templates with department === null)
  const uniqueCategoryTemplates = Array.from(new Set(categoriesList.map(c => c.name))).map(name => {
    return categoriesList.find(c => c.name === name);
  });

  // Filtered departments based on search query
  const filteredDepartments = departmentsList.filter(dept => 
    dept.name.toLowerCase().includes(deptSearchQuery.toLowerCase()) ||
    (dept.description || '').toLowerCase().includes(deptSearchQuery.toLowerCase())
  );

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* Title block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Departments Portal</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Audit active complaints or configure custom organization departments and templates.
          </p>
        </div>
        <button 
          className="theme-toggle" 
          onClick={activeTab === 'audit' ? fetchAllComplaints : () => { fetchDepartments(); fetchCategoriesList(); }} 
          title="Reload data"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', paddingBottom: '0px' }}>
        <button
          onClick={() => setActiveTab('audit')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '2px solid var(--accent-color)' : '2px solid transparent',
            color: activeTab === 'audit' ? 'var(--text-primary)' : 'var(--text-secondary)',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          Audit metrics
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'manage' ? '2px solid var(--accent-color)' : '2px solid transparent',
            color: activeTab === 'manage' ? 'var(--text-primary)' : 'var(--text-secondary)',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          Manage Departments
        </button>
      </div>

      {activeTab === 'audit' ? (
        loading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <div 
              className="spinner"
              style={{
                width: '32px',
                height: '32px',
                border: '2px solid var(--border-color)',
                borderTopColor: 'var(--accent-color)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }}
            />
          </div>
        ) : departments.length === 0 ? (
          <div className="dashboard-panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            No complaints found in the database. Departments generate dynamically based on audit assignments.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {departments.map((dept) => {
              const resolutionRate = dept.total > 0 ? Math.round((dept.resolved / dept.total) * 100) : 0;
              const isExpanded = expandedDept === dept.name;

              return (
                <div 
                  key={dept.name} 
                  className="dashboard-panel"
                  style={{ 
                    margin: 0, 
                    padding: '24px',
                    borderColor: isExpanded ? 'var(--accent-color)' : 'var(--border-color)',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  {/* Department Card Header */}
                  <div 
                    onClick={() => handleToggleExpand(dept.name)}
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'auto 2fr 1fr 1.5fr auto', 
                      alignItems: 'center', 
                      gap: '24px', 
                      cursor: 'pointer' 
                    }}
                  >
                    <div 
                      style={{ 
                        width: '46px', 
                        height: '46px', 
                        borderRadius: 'var(--border-radius-sm)', 
                        backgroundColor: 'rgba(99, 102, 241, 0.08)',
                        color: 'var(--accent-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Building2 size={20} />
                    </div>

                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800 }}>{dept.name}</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Total Tickets: <strong>{dept.total}</strong>
                      </span>
                    </div>

                    {/* Status Breakdown Mini Panel */}
                    <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-pending-text)' }}>
                        <Clock size={14} />
                        <strong>{dept.pending}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-assigned-text)' }}>
                        <AlertTriangle size={14} />
                        <strong>{dept.active}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-resolved-text)' }}>
                        <CheckCircle2 size={14} />
                        <strong>{dept.resolved}</strong>
                      </div>
                    </div>

                    {/* Progress Bar Layout */}
                    <div style={{ paddingRight: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Resolution Rate</span>
                        <strong style={{ color: 'var(--status-resolved-text)' }}>{resolutionRate}%</strong>
                      </div>
                      <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            height: '100%', 
                            width: `${resolutionRate}%`, 
                            background: 'var(--status-resolved-text)',
                            borderRadius: '3px',
                            transition: 'width 0.4s ease-out'
                          }} 
                        />
                      </div>
                    </div>

                    <div>
                      {isExpanded ? <ChevronDown size={18} className="text-muted" /> : <ChevronRight size={18} className="text-muted" />}
                    </div>
                  </div>

                  {/* Expandable Department Complaints Queue */}
                  {isExpanded && (
                    <div 
                      style={{ 
                        marginTop: '24px', 
                        borderTop: '1px solid var(--border-color)', 
                        paddingTop: '20px', 
                        animation: 'slideUp 0.3s ease-out' 
                      }}
                    >
                      <div className="table-container">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Title</th>
                              <th>Citizen</th>
                              <th>Priority</th>
                              <th>Status</th>
                              <th>Date Assigned</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {dept.tickets.map((c) => (
                              <tr key={c._id} onClick={() => navigate(`/complaints/${c._id}`)}>
                                <td className="detail-id">{c.trackingId}</td>
                                <td style={{ fontWeight: 600 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                    <span>{c.title}</span>
                                    {getSlaFlag(c)}
                                  </div>
                                </td>
                                <td>{c.citizen?.name || 'Citizen'}</td>
                                <td>{getPriorityBadge(c.priority)}</td>
                                <td>{getStatusBadge(c.status)}</td>
                                <td>{new Date(c.updatedAt || c.createdAt).toLocaleDateString()}</td>
                                <td>
                                  <ArrowRight size={14} className="text-accent" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }} className="dashboard-grid">
          
          {/* Department Form Panel */}
          <div className="dashboard-panel" style={{ height: 'fit-content' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '20px' }}>
              {isEditingDept ? 'Edit Department' : 'Create Department'}
            </h3>
            <form onSubmit={handleSubmitDept}>
              <div className="form-group">
                <label className="form-label">Department Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Finance & Auditing"
                  value={deptFormName}
                  onChange={(e) => setDeptFormName(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  placeholder="Brief purpose of the department..."
                  value={deptFormDesc}
                  onChange={(e) => setDeptFormDesc(e.target.value)}
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Dynamic Checkboxes to copy categories on Create Mode only */}
              {!isEditingDept && uniqueCategoryTemplates.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <label className="form-label" style={{ marginBottom: '10px' }}>
                    Duplicate Category Templates
                  </label>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
                    Select existing categories to automatically copy/add to this new department:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {uniqueCategoryTemplates.map((template) => (
                      <label 
                        key={template._id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '10px', 
                          fontSize: '13px', 
                          color: 'var(--text-primary)', 
                          cursor: 'pointer' 
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategoriesToCopy.includes(template.name)}
                          onChange={() => handleCheckboxChange(template.name)}
                        />
                        <span>{template.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ 
                    flex: 1, 
                    backgroundColor: 'var(--accent-color)', 
                    color: 'white',
                    border: 'none',
                    padding: '12px',
                    borderRadius: 'var(--border-radius-sm)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  disabled={saving}
                >
                  {isEditingDept ? 'Update' : 'Create'}
                </button>
                {isEditingDept && (
                  <button
                    type="button"
                    className="btn"
                    onClick={handleCancelEditDept}
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                      padding: '12px 18px',
                      borderRadius: 'var(--border-radius-sm)',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Departments List Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Optimized Search Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Manage Organization Departments</h3>
              <div className="search-input-wrapper" style={{ minWidth: '200px', flex: 'none', margin: 0 }}>
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search departments..."
                  value={deptSearchQuery}
                  onChange={(e) => setDeptSearchQuery(e.target.value)}
                  style={{ paddingLeft: '36px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', fontSize: '13px' }}
                />
              </div>
            </div>
            
            {deptLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div 
                  className="spinner"
                  style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid var(--border-color)',
                    borderTopColor: 'var(--accent-color)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                  }}
                />
              </div>
            ) : filteredDepartments.length === 0 ? (
              <div className="dashboard-panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                {deptSearchQuery ? 'No matching departments found.' : 'No departments defined in system.'}
              </div>
            ) : (
              filteredDepartments.map((dept) => {
                const activeDeptCats = dept.categories || [];
                const existingNames = activeDeptCats.map(c => c.name);
                const availableTemplates = categoriesList.filter(c => !existingNames.includes(c.name) && c.isActive);
                const isCatsExpanded = expandedDeptCatsId === dept._id;

                return (
                  <div 
                    key={dept._id}
                    className="dashboard-panel"
                    style={{ margin: 0, padding: '24px', transition: 'border-color var(--transition-fast)', borderColor: isCatsExpanded ? 'var(--accent-color)' : 'var(--border-color)' }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <h4 style={{ fontSize: '16px', fontWeight: 800 }}>{dept.name}</h4>
                          <span className={`badge ${dept.isActive ? 'badge-status-resolved' : 'badge-status-rejected'}`} style={{ fontSize: '9px', padding: '2px 8px' }}>
                            {dept.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
                          {dept.description || 'No description provided.'}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          onClick={() => handleEditDeptClick(dept)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleToggleDeptActive(dept)}
                          className="btn"
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: dept.isActive ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                            color: dept.isActive ? 'var(--status-rejected-text)' : 'var(--status-resolved-text)',
                            border: '1px solid rgba(255,255,255,0.03)'
                          }}
                        >
                          {dept.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>

                    {/* Department's Categories Summary View */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Categories:
                        </span>
                        {activeDeptCats.length === 0 ? (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>None assigned</span>
                        ) : (
                          activeDeptCats.map((cat) => (
                            <span 
                              key={cat._id}
                              style={{ 
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                fontSize: '12px',
                                color: 'var(--text-secondary)'
                              }}
                            >
                              <span>{cat.name}</span>
                              <button
                                onClick={() => handleRemoveCategory(dept._id, cat._id, cat.name)}
                                title="Remove category from department"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '2px',
                                  marginLeft: '4px'
                                }}
                              >
                                <X size={10} className="hover:text-error" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      {/* Expandable trigger button */}
                      <button
                        onClick={() => setExpandedDeptCatsId(isCatsExpanded ? null : dept._id)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <span style={{ fontWeight: 600 }}>Manage Categories</span>
                        {isCatsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </div>

                    {/* Collapsible Category Association Form */}
                    {isCatsExpanded && (
                      <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '16px', marginTop: '16px', animation: 'slideUp 0.3s ease-out' }}>
                        
                        {/* Department Routing Group Selection */}
                        <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '16px', marginBottom: '16px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                            Department Support Routing Group
                          </label>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
                            Select the support group/team responsible for handling all complaints under this department. Groups are independent of departments.
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <select
                              className="form-control"
                              value={dept.routingGroup?._id || dept.routingGroup || ''}
                              onChange={async (e) => {
                                const newGroupId = e.target.value || null;
                                try {
                                  const response = await fetch(`/api/departments/${dept._id}`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${user.token}`
                                    },
                                    body: JSON.stringify({ routingGroup: newGroupId })
                                  });
                                  const result = await response.json();
                                  if (result.success) {
                                    addToast('Success', 'Updated routing group for department successfully', 'success');
                                    fetchDepartments();
                                  } else {
                                    addToast('Error', result.message, 'error');
                                  }
                                } catch (err) {
                                  addToast('Error', 'Failed to update department routing group', 'error');
                                }
                              }}
                              style={{ padding: '8px', fontSize: '13px', minWidth: '280px', maxWidth: '360px' }}
                            >
                              <option value="">-- Route collectively to all groups of this department --</option>
                              {groups.map((group) => (
                                <option key={group._id} value={group._id}>
                                  {group.name}
                                </option>
                              ))}
                            </select>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                              {dept.routingGroup ? `Currently routed to: ${dept.routingGroup.name || 'Selected Group'}` : 'Currently routed collectively to all groups under this department'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '16px' }}>
                          
                          {/* Copy Template Column */}
                          <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                              Copy Existing Template
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <select
                                className="form-control"
                                value={selectedTemplates[dept._id] || ''}
                                onChange={(e) => setSelectedTemplates({ ...selectedTemplates, [dept._id]: e.target.value })}
                                style={{ padding: '8px', fontSize: '13px', flex: 1 }}
                                disabled={availableTemplates.length === 0}
                              >
                                <option value="">-- Select Template --</option>
                                {availableTemplates.map((cat) => (
                                  <option key={cat._id} value={cat.name}>{cat.name}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleCopyCategoryTemplate(dept._id)}
                                className="btn btn-primary"
                                style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap', backgroundColor: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: 'var(--border-radius-sm)', fontWeight: 600, cursor: 'pointer' }}
                                disabled={availableTemplates.length === 0 || !selectedTemplates[dept._id] || saving}
                              >
                                Copy & Add
                              </button>
                            </div>
                            {availableTemplates.length === 0 && (
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                All templates are already in this department.
                              </span>
                            )}
                          </div>

                          {/* Go to Category Fields Creation Page Column */}
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                              Create Brand New Category
                            </label>
                            <button
                              onClick={() => navigate('/manage-fields')}
                              className="btn btn-secondary"
                              style={{ 
                                padding: '8px 16px', 
                                fontSize: '13px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '6px', 
                                fontWeight: 600, 
                                cursor: 'pointer',
                                height: '38px',
                                border: '1px dashed var(--border-color)',
                                backgroundColor: 'transparent'
                              }}
                            >
                              <Plus size={14} />
                              <span>Go to Category Fields Builder</span>
                            </button>
                          </div>

                        </div>

                        {/* Current Categories Routing Configuration Two-Column Panel */}
                        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: '12px' }}>
                            Current Categories Routing Configuration
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            
                            {/* Left Column: Support Groups */}
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '16px' }}>
                              {(() => {
                                const routingGroupObj = dept.routingGroup ? groups.find(g => g._id === (dept.routingGroup._id || dept.routingGroup)) : null;
                                const deptGroups = groups.filter((g) => g.department && (g.department._id === dept._id || g.department === dept._id));
                                
                                if (routingGroupObj) {
                                  return (
                                    <>
                                      <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                                        <Users size={14} className="text-accent" />
                                        Primary Assigned Routing Group (1)
                                      </label>
                                      <div 
                                        style={{ 
                                          padding: '10px 12px', 
                                          backgroundColor: 'rgba(99, 102, 241, 0.04)', 
                                          border: '1px dashed var(--accent-color)', 
                                          borderRadius: '6px' 
                                        }}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>{routingGroupObj.name}</span>
                                          <span className="badge badge-status-resolved" style={{ fontSize: '9px', padding: '2px 6px' }}>
                                            Active Route
                                          </span>
                                        </div>
                                        {routingGroupObj.description && (
                                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
                                            {routingGroupObj.description}
                                          </p>
                                        )}
                                      </div>
                                    </>
                                  );
                                }

                                return (
                                  <>
                                    <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                                      <Users size={14} className="text-accent" />
                                      Support Groups & Teams ({deptGroups.length})
                                    </label>
                                    {deptGroups.length === 0 ? (
                                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        No default support groups defined for this department.
                                      </p>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {deptGroups.map((g) => (
                                          <div 
                                            key={g._id} 
                                            style={{ 
                                              padding: '10px 12px', 
                                              backgroundColor: 'rgba(255,255,255,0.02)', 
                                              border: '1px solid var(--border-color)', 
                                              borderRadius: '6px' 
                                            }}
                                          >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{g.name}</span>
                                              <span className="badge badge-status-assigned" style={{ fontSize: '9px', padding: '2px 6px' }}>
                                                {g.members?.length || 0} members
                                              </span>
                                            </div>
                                            {g.description && (
                                              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
                                                {g.description}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>

                            {/* Right Column: Categories Routed to Teams */}
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '16px' }}>
                              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                                <FileText size={14} className="text-accent" />
                                Categories Routed to Teams ({activeDeptCats.length})
                              </label>
                              
                              {activeDeptCats.length === 0 ? (
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  No categories assigned to this department.
                                </p>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ShieldAlert size={12} className="text-accent" />
                                    <span>
                                      {dept.routingGroup 
                                        ? `All complaints under these categories collectively route to the configured team "${dept.routingGroup.name || 'Selected Group'}".`
                                        : 'All complaints under these categories collectively route to the support groups on the left.'}
                                    </span>
                                  </div>
                                  {activeDeptCats.map((cat) => (
                                    <div 
                                      key={cat._id}
                                      style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        backgroundColor: 'rgba(255,255,255,0.02)', 
                                        border: '1px solid var(--border-color)', 
                                        borderRadius: '6px', 
                                        padding: '8px 12px'
                                      }}
                                    >
                                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                                        {cat.name}
                                      </div>
                                      <button
                                        onClick={() => handleRemoveCategory(dept._id, cat._id, cat.name)}
                                        className="btn"
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: '11px',
                                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                          color: 'var(--status-rejected-text)',
                                          border: '1px solid rgba(255,255,255,0.03)',
                                          borderRadius: '4px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default DepartmentDashboard;
