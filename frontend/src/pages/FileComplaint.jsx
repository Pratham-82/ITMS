import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Upload, X, File, ArrowLeft } from 'lucide-react';

const FileComplaint = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedAssetId = searchParams.get('assetId');
  const preselectedSerialNumber = searchParams.get('serialNumber');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Low');
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [selectedTicketType, setSelectedTicketType] = useState('');

  // Decoupled Drilldown States
  const [departments, setDepartments] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);

  // Dynamic Fields States
  const [selectedFields, setSelectedFields] = useState([]);
  const [customFields, setCustomFields] = useState({});

  // Asset selection states
  const [availableAssets, setAvailableAssets] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');

  const fileInputRef = useRef(null);
  const selectedDepartmentRef = useRef(selectedDepartment);
  const categoryRef = useRef(category);

  useEffect(() => {
    selectedDepartmentRef.current = selectedDepartment;
  }, [selectedDepartment]);

  useEffect(() => {
    categoryRef.current = category;
  }, [category]);

  // Fetch active assets for linking
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await fetch('/api/assets?limit=100', {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        const json = await res.json();
        if (json.success) {
          setAvailableAssets(json.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch assets', err);
      }
    };
    if (user?.token) {
      fetchAssets();
    }
  }, [user]);

  useEffect(() => {
    if (availableAssets.length > 0) {
      if (preselectedAssetId) {
        const found = availableAssets.find(a => a._id === preselectedAssetId);
        if (found) {
          setSelectedAssets(prev => {
            if (!prev.some(x => x._id === found._id)) {
              return [...prev, found];
            }
            return prev;
          });
        }
      } else if (preselectedSerialNumber) {
        const found = availableAssets.find(a => a.serialNumber?.toLowerCase() === preselectedSerialNumber.toLowerCase());
        if (found) {
          setSelectedAssets(prev => {
            if (!prev.some(x => x._id === found._id)) {
              return [...prev, found];
            }
            return prev;
          });
        }
      }
    }
  }, [availableAssets, preselectedAssetId, preselectedSerialNumber]);

  // AI Routing States
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [aiSettings, setAiSettings] = useState(null);
  const [isAiClassifying, setIsAiClassifying] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverridePrompt, setShowOverridePrompt] = useState(false);
  const [aiAccepted, setAiAccepted] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Duplicate Detection States
  const [similarComplaints, setSimilarComplaints] = useState([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [selectedDuplicate, setSelectedDuplicate] = useState(null);
  const [joinRemarks, setJoinRemarks] = useState('');
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [showDuplicateOverridePrompt, setShowDuplicateOverridePrompt] = useState(false);
  const [duplicateOverrideReason, setDuplicateOverrideReason] = useState('');
  const [duplicateRateLimitError, setDuplicateRateLimitError] = useState(null);

  // Fetch allowed ticket types
  useEffect(() => {
    const fetchTicketTypes = async () => {
      try {
        const res = await fetch('/api/tickets/types', {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        const json = await res.json();
        if (json.success) {
          setTicketTypes(json.data || []);
          const complaintType = (json.data || []).find(t => t.name === 'Complaint');
          if (complaintType) {
            setSelectedTicketType(complaintType._id);
          } else if (json.data && json.data.length > 0) {
            setSelectedTicketType(json.data[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch ticket types', err);
      }
    };
    if (user?.token) {
      fetchTicketTypes();
    }
  }, [user]);

  // Fetch active departments and categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        const deptRes = await fetch('/api/departments', { headers: { Authorization: `Bearer ${user.token}` } });
        const deptJson = await deptRes.json();

        if (deptJson.success) {
          const activeDepts = deptJson.data.filter(d => d.isActive);
          setDepartments(activeDepts);

          // Extract unique categories from all departments for backward compatibility lookups
          const flatCats = [];
          const seenCatIds = new Set();
          activeDepts.forEach(dept => {
            (dept.categories || []).forEach(cat => {
              if (!seenCatIds.has(cat._id)) {
                seenCatIds.add(cat._id);
                flatCats.push(cat);
              }
            });
          });
          setAllCategories(flatCats);

          if (activeDepts.length > 0) {
            const firstDept = activeDepts[0];
            setSelectedDepartment(firstDept._id);

            const filtered = firstDept.categories || [];
            setFilteredCategories(filtered);

            if (filtered.length > 0) {
              setCategory(filtered[0]._id);
              setSelectedFields(filtered[0].fields || []);
            } else {
              setCategory('');
              setSelectedFields([]);
            }
          }
        } else {
          addToast('Error', 'Failed to retrieve classification data', 'error');
        }
      } catch (err) {
        console.error(err);
        addToast('Error', 'Failed to retrieve form fields templates', 'error');
      } finally {
        setLoading(false);
      }
    };

    if (user?.token) {
      fetchData();
    }
  }, [user]);

  // Real-time debounced AI routing trigger
  useEffect(() => {
    if (title.trim().length < 5 && description.trim().length < 10) {
      setAiRecommendation(null);
      setShowOverridePrompt(false);
      setAiError(null);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsAiClassifying(true);
      setAiError(null);
      try {
        const res = await fetch('/api/ai/classify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`
          },
          body: JSON.stringify({ title, description })
        });

        if (res.status === 429) {
          const json = await res.json();
          const msg = json.message || 'AI routing rate limit exceeded. Please wait.';
          setAiError(msg);
          addToast('AI Limit Exceeded', msg, 'error');
          setAiRecommendation(null);
          setShowOverridePrompt(false);
          setAiAccepted(false);
          return;
        }

        const json = await res.json();
        if (json.success && json.aiEnabled && json.department) {
          const dept = json.department;
          const cat = json.category;

          // Build a unified recommendation object for compatibility
          const rec = {
            departmentId: dept.id,
            departmentName: dept.name,
            departmentConfidence: dept.confidence,
            departmentReasoning: dept.reasoning,
            categoryId: cat ? cat.id : null,
            categoryName: cat ? cat.name : null,
            categoryConfidence: cat ? cat.confidence : 0,
            categoryReasoning: cat ? cat.reasoning : '',
            confidence: cat ? Math.min(dept.confidence, cat.confidence) : dept.confidence,
            reasoning: `Department: ${dept.reasoning || ''}${cat?.reasoning ? `; Category: ${cat.reasoning}` : ''}`
          };

          setAiRecommendation(rec);
          setAiSettings(json.settings || {});
          setAiError(null);

          const hasDeptAuto = dept.confidence >= 0.90;
          const hasCatAuto = cat && cat.confidence >= 0.90;

          // 1. Auto-assign case (Both department and category confidence >= 0.90)
          if (hasDeptAuto && hasCatAuto) {
            setSelectedDepartment(dept.id);
            const deptObj = departments.find(d => d._id === dept.id);
            const filtered = deptObj ? (deptObj.categories || []) : [];
            setFilteredCategories(filtered);
            setCategory(cat.id);

            const targetCat = filtered.find(c => c._id === cat.id);
            setSelectedFields(targetCat ? targetCat.fields : []);

            setAiAccepted(true);
            setShowOverridePrompt(false);
          }
          // 2. Suggestion/Partial/Manual cases
          else {
            // If department auto-accept threshold is met, auto-assign department and require manual category selection
            if (hasDeptAuto) {
              setSelectedDepartment(dept.id);
              const deptObj = departments.find(d => d._id === dept.id);
              const filtered = deptObj ? (deptObj.categories || []) : [];
              setFilteredCategories(filtered);
              
              setCategory('');
              setSelectedFields([]);
              setAiAccepted(false);
              setShowOverridePrompt(false); // category is manual selection, so no override is required yet
            }
            // If department confidence is between 0.70 and 0.89: Show AI suggestion
            else if (dept.confidence >= 0.70) {
              setAiAccepted(false);
              // Verify if current selections deviate from recommendation
              const isDeptDiff = selectedDepartmentRef.current !== dept.id;
              const isCatDiff = cat && categoryRef.current !== cat.id;
              if (isDeptDiff || isCatDiff) {
                setShowOverridePrompt(true);
              } else {
                setShowOverridePrompt(false);
              }
            }
            // If department confidence < 0.70: Require manual selection
            else {
              setAiRecommendation(null);
              setShowOverridePrompt(false);
              setAiAccepted(false);
            }
          }
        } else {
          const fallbackMsg = json.message || 'AI routing is unavailable. Please select department and category manually.';
          setAiError(fallbackMsg);
          setAiRecommendation(null);
          setShowOverridePrompt(false);
          setAiAccepted(false);
        }
      } catch (err) {
        console.error('Classification error:', err);
        const errMsg = err.message || 'Failed to connect to the AI classification system. Please specify routing manually.';
        setAiError(errMsg);
        setAiRecommendation(null);
        setShowOverridePrompt(false);
        setAiAccepted(false);
      } finally {
        setIsAiClassifying(false);
      }
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [title, description, allCategories, user.token]);

  // Real-time debounced duplicate check
  useEffect(() => {
    if (title.trim().length < 5 || description.trim().length < 10) {
      setSimilarComplaints([]);
      setShowDuplicateOverridePrompt(false);
      setDuplicateRateLimitError(null);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsCheckingDuplicates(true);
      setDuplicateRateLimitError(null);
      try {
        const deptObj = departments.find(d => d._id === selectedDepartment);
        const res = await fetch('/api/duplicates/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`
          },
          body: JSON.stringify({
            title,
            description,
            categoryId: category,
            departmentName: deptObj ? deptObj.name : undefined
          })
        });

        if (res.status === 429) {
          const json = await res.json();
          const msg = json.message || 'Duplicate check rate limit exceeded. Please try again later.';
          setDuplicateRateLimitError(msg);
          addToast('Duplicate Check Limit Exceeded', msg, 'error');
          setSimilarComplaints([]);
          setShowDuplicateOverridePrompt(false);
          return;
        }

        const json = await res.json();
        if (json.success && json.data) {
          setSimilarComplaints(json.data);
          
          // Check if there is any Definite Duplicate (similarityScore >= 0.95)
          const hasDefinite = json.data.some(c => c.similarityScore >= 0.95);
          if (hasDefinite) {
            setShowDuplicateOverridePrompt(true);
          } else {
            setShowDuplicateOverridePrompt(false);
          }
        } else {
          setSimilarComplaints([]);
          setShowDuplicateOverridePrompt(false);
        }
      } catch (err) {
        console.error('Duplicate check error:', err);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [title, description, selectedDepartment, category, departments, user.token]);

  // Check if manual selection overrides AI recommendation
  const checkIfOverride = (deptId, catId) => {
    if (!aiRecommendation || !aiSettings) return;

    const isDeptDiff = aiRecommendation.departmentId && deptId !== aiRecommendation.departmentId;
    const isCatDiff = aiRecommendation.categoryId && catId !== aiRecommendation.categoryId;

    if (isDeptDiff || isCatDiff) {
      setShowOverridePrompt(true);
      setAiAccepted(false);
    } else {
      setShowOverridePrompt(false);
      setAiAccepted(true);
    }
  };

  const handleDepartmentChange = (deptId) => {
    setSelectedDepartment(deptId);
    const deptObj = departments.find(d => d._id === deptId);
    const filtered = deptObj ? (deptObj.categories || []) : [];
    setFilteredCategories(filtered);

    let nextCatId = '';
    if (filtered.length > 0) {
      nextCatId = filtered[0]._id;
      setCategory(nextCatId);
      setSelectedFields(filtered[0].fields || []);
    } else {
      setCategory('');
      setSelectedFields([]);
    }
    setCustomFields({}); // Reset field inputs on department change
    checkIfOverride(deptId, nextCatId);
  };

  const handleCategoryChange = (catId) => {
    setCategory(catId);
    const cat = filteredCategories.find(c => c._id === catId);
    setSelectedFields(cat ? cat.fields : []);
    setCustomFields({}); // Reset field inputs on type change
    checkIfOverride(selectedDepartment, catId);
  };

  const acceptRecommendation = () => {
    if (!aiRecommendation) return;

    let filtered = [];
    if (aiRecommendation.departmentId) {
      setSelectedDepartment(aiRecommendation.departmentId);
      const deptObj = departments.find(d => d._id === aiRecommendation.departmentId);
      filtered = deptObj ? (deptObj.categories || []) : [];
      setFilteredCategories(filtered);
    }

    if (aiRecommendation.categoryId) {
      setCategory(aiRecommendation.categoryId);
      const targetCat = filtered.find(c => c._id === aiRecommendation.categoryId) || 
                        allCategories.find(c => c._id === aiRecommendation.categoryId);
      setSelectedFields(targetCat ? targetCat.fields : []);
    }

    setAiAccepted(true);
    setShowOverridePrompt(false);
    setOverrideReason('');
    addToast('Recommendation Applied', 'Complaint routing fields updated successfully', 'success');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles) => {
    const validFiles = newFiles.filter(file => {
      const allowedExts = /jpeg|jpg|png|pdf/i;
      const isValidExt = allowedExts.test(file.name.split('.').pop());
      const isValidSize = file.size <= 5 * 1024 * 1024;

      if (!isValidExt) {
        addToast('File Rejected', `${file.name} is not a valid format. Images (PNG, JPG) and PDFs only.`, 'error');
      }
      if (!isValidSize) {
        addToast('File Rejected', `${file.name} exceeds the 5MB size limit.`, 'error');
      }

      return isValidExt && isValidSize;
    });

    setFiles((prev) => {
      const combined = [...prev, ...validFiles];
      if (combined.length > 5) {
        addToast('Files Limit', 'You can upload a maximum of 5 files. Extra files truncated.', 'info');
        return combined.slice(0, 5);
      }
      return combined;
    });
  };

  const removeFile = (indexToRemove) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !description || !category || !priority || !selectedTicketType) {
      addToast('Validation Error', 'Please fill in all mandatory fields', 'error');
      return;
    }

    if (showOverridePrompt && !overrideReason.trim()) {
      addToast('Validation Error', 'Please specify a reason for overriding the AI recommendation.', 'error');
      return;
    }

    if (showDuplicateOverridePrompt && !duplicateOverrideReason.trim()) {
      addToast('Validation Error', 'Please specify a reason for overriding the duplicate warning.', 'error');
      return;
    }

    // Validate dynamic custom fields requirements
    for (const field of selectedFields) {
      if (field.required && (!customFields[field.label] || customFields[field.label].toString().trim() === '')) {
        addToast('Form Incomplete', `"${field.label}" is a required field.`, 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('department', selectedDepartment);
      formData.append('category', category);
      formData.append('priority', priority);
      formData.append('ticketType', selectedTicketType);
      formData.append('customFields', JSON.stringify(customFields));

      if (showDuplicateOverridePrompt && duplicateOverrideReason) {
        formData.append('duplicateOverrideReason', duplicateOverrideReason);
        const definiteDup = similarComplaints.find(c => c.similarityScore >= 0.95);
        if (definiteDup) {
          formData.append('parentComplaintId', definiteDup.complaintId);
        }
      }

      // Package AI Routing metadata
      if (aiRecommendation) {
        const isOverridden = (aiRecommendation.departmentId && selectedDepartment !== aiRecommendation.departmentId) ||
                             (aiRecommendation.categoryId && category !== aiRecommendation.categoryId);

        const aiRoutingPayload = {
          suggestedDepartment: aiRecommendation.departmentName,
          suggestedCategory: aiRecommendation.categoryId,
          suggestedCategoryName: aiRecommendation.categoryName,
          confidence: aiRecommendation.confidence,
          reasoning: aiRecommendation.reasoning,
          userOverride: isOverridden,
          overrideReason: isOverridden ? overrideReason : null,
          acceptedRecommendation: !isOverridden
        };
        formData.append('aiRouting', JSON.stringify(aiRoutingPayload));
      }

      selectedAssets.forEach(a => {
        formData.append('relatedAssets', a._id);
      });

      files.forEach((file) => {
        formData.append('attachments', file);
      });

      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        addToast('Filing Successful', `Complaint tracking code is: ${result.data.trackingId}`, 'success');
        navigate('/');
      } else {
        addToast('Filing Failed', result.message || 'Error occurred while saving', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Communication failure with server', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => navigate('/')} className="btn btn-secondary" style={{ padding: '8px 16px', gap: '6px' }}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div className="form-card">
        <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>File a Complaint</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>
          Provide clear details below. Our officers will audit and prioritize your ticket.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading available form templates...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {ticketTypes.length > 0 && (
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Ticket Type *</label>
                <select
                  className="form-control"
                  value={selectedTicketType}
                  onChange={(e) => setSelectedTicketType(e.target.value)}
                  required
                >
                  {ticketTypes.map((type) => (
                    <option key={type._id} value={type._id}>
                      {type.name} - {type.description}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Department *</label>
                <select 
                  className="form-control" 
                  value={selectedDepartment}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  required
                >
                  <option value="">-- Choose Department --</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Category *</label>
                <select 
                  className="form-control" 
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  required
                  disabled={filteredCategories.length === 0}
                >
                  {filteredCategories.length === 0 ? (
                    <option value="">-- No Categories under this Department --</option>
                  ) : (
                    <>
                      <option value="">-- Choose Category --</option>
                      {filteredCategories.map((c) => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Priority Level *</label>
                <select 
                  className="form-control" 
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  required
                >
                  <option value="Low">Low - Normal Inquiry</option>
                  <option value="Medium">Medium - Standard Issue</option>
                  <option value="High">High - Critical Issue</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Issue Title *</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. Malfunctioning AC in Conference Room B" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Detailed Description *</label>
              <textarea 
                className="form-control" 
                rows="6"
                placeholder="Please explain the problem in details. Provide locations, names, or actions taken to help our audit team resolving it quicker..." 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginTop: '20px' }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '13.5px' }}>Link Affected Asset(s)</label>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                If this issue is related to specific assets/equipment, search and select them below.
              </p>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search assets by code or name... (e.g. LAP-000001)"
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>

              {/* Matching Search Results */}
              {assetSearchQuery.trim() !== '' && (
                <div style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  marginBottom: '12px',
                  boxShadow: 'var(--box-shadow-sm)'
                }}>
                  {availableAssets
                    .filter(a => 
                      !selectedAssets.some(sel => sel._id === a._id) &&
                      (a.name.toLowerCase().includes(assetSearchQuery.toLowerCase()) || 
                       a.assetCode.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
                       (a.serialNumber && a.serialNumber.toLowerCase().includes(assetSearchQuery.toLowerCase())))
                    )
                    .map(a => (
                      <div key={a._id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--border-color)',
                        fontSize: '12.5px'
                      }}>
                        <div>
                          <strong style={{ color: 'var(--accent-color)' }}>{a.assetCode}</strong> - {a.name} 
                          {a.serialNumber && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>(S/N: {a.serialNumber})</span>}
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>({a.assetTypeId?.name || 'Asset'})</span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedAssets([...selectedAssets, a]);
                            setAssetSearchQuery('');
                          }}
                          style={{ padding: '2px 8px', fontSize: '11.5px', cursor: 'pointer' }}
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  {availableAssets.filter(a => 
                    !selectedAssets.some(sel => sel._id === a._id) &&
                    (a.name.toLowerCase().includes(assetSearchQuery.toLowerCase()) || 
                     a.assetCode.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
                     (a.serialNumber && a.serialNumber.toLowerCase().includes(assetSearchQuery.toLowerCase())))
                  ).length === 0 && (
                    <div style={{ padding: '8px 12px', fontSize: '12.5px', color: 'var(--text-muted)' }}>No matching assets found</div>
                  )}
                </div>
              )}

              {/* Currently Selected Assets */}
              {selectedAssets.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {selectedAssets.map(a => (
                    <span key={a._id} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      color: 'var(--accent-color)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      padding: '4px 10px',
                      borderRadius: '16px'
                    }}>
                      {a.assetCode}: {a.name}
                      <button
                        type="button"
                        onClick={() => setSelectedAssets(selectedAssets.filter(sel => sel._id !== a._id))}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-color)',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          fontWeight: 800,
                          fontSize: '14px',
                          marginLeft: '4px'
                        }}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Similar Complaints Alert Panel */}
            {isCheckingDuplicates && (
              <div style={{ fontSize: '13px', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                <span className="spinner-border text-primary" role="status" style={{ width: '1rem', height: '1rem', display: 'inline-block', border: '.15em solid currentColor', borderRightColor: 'transparent', borderRadius: '50%', animation: 'spinner-border .75s linear infinite' }}></span>
                <span>Checking for similar complaints...</span>
              </div>
            )}

            {duplicateRateLimitError && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                borderRadius: 'var(--border-radius-md)',
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{duplicateRateLimitError}</span>
              </div>
            )}

            {similarComplaints.length > 0 && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                borderRadius: 'var(--border-radius-md)',
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                animation: 'slideDown 0.3s ease-out'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 700, marginBottom: '12px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
                  </svg>
                  <span>AI Detected Similar Complaints ({similarComplaints.length})</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  To help reduce duplicate tickets, please check if your issue is already reported. You can join an existing issue to boost its priority instead of filing a new one.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {similarComplaints.map(comp => (
                    <div key={comp.complaintId} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: 'var(--border-radius-sm)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      fontSize: '13px'
                    }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--accent-color)', marginRight: '8px' }}>{comp.trackingId}</span>
                        <span style={{ color: 'var(--text-primary)' }}>{comp.title}</span>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Similarity: <strong style={{ color: comp.similarityScore >= 0.95 ? '#ef4444' : '#f59e0b' }}>{(comp.similarityScore * 100).toFixed(0)}%</strong> ({comp.matchLevel})
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedDuplicate(comp);
                          setJoinRemarks('');
                          setShowDuplicateModal(true);
                        }}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        View & Join
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showDuplicateOverridePrompt && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                borderRadius: 'var(--border-radius-md)',
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                animation: 'fadeIn 0.3s ease-out'
              }}>
                <label className="form-label" style={{ color: '#ef4444', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                  Definite Duplicate Detected *
                </label>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Your complaint details are extremely similar (95%+) to an existing open ticket. To file a separate ticket anyway, you must provide a justification.
                </p>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Explain why this is a unique issue and not a duplicate (e.g. This is a separate AC unit in the same room)..."
                  value={duplicateOverrideReason}
                  onChange={(e) => setDuplicateOverrideReason(e.target.value)}
                  required={showDuplicateOverridePrompt}
                  style={{ fontSize: '13px' }}
                />
              </div>
            )}

            {/* AI Assistant Widget */}
            {(isAiClassifying || aiRecommendation || aiError) && (
              <div 
                style={{
                  marginTop: '24px',
                  marginBottom: '24px',
                  padding: '20px',
                  borderRadius: 'var(--border-radius-md)',
                  background: aiError ? 'rgba(239, 68, 68, 0.02)' : 'rgba(255, 255, 255, 0.02)',
                  border: aiError ? '1px dashed rgba(239, 68, 68, 0.3)' : '1px dashed var(--border-color)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: 'var(--box-shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Glow effect */}
                <div 
                  style={{
                    position: 'absolute',
                    top: '-50%',
                    left: '-50%',
                    width: '200%',
                    height: '200%',
                    background: aiError 
                      ? 'radial-gradient(circle, rgba(239, 68, 68, 0.04) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(99, 102, 241, 0.04) 0%, transparent 70%)',
                    pointerEvents: 'none'
                  }}
                />

                {aiError ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      padding: '8px',
                      borderRadius: '50%',
                      color: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: '2px'
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 4px 0', color: '#ef4444' }}>
                        {aiError.toLowerCase().includes('rate limit') || aiError.toLowerCase().includes('too many requests')
                          ? 'AI Smart Routing Rate Limit Exceeded' 
                          : 'AI Smart Routing Error / Failure'}
                      </h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0', lineHeight: 1.5 }}>
                        {aiError} Please select the department and category manually below.
                      </p>
                    </div>
                  </div>
                ) : isAiClassifying ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-color)' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-color)',
                      boxShadow: '0 0 8px var(--accent-color)'
                    }} />
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>AI is evaluating your complaint details for smart routing...</span>
                  </div>
                ) : aiRecommendation ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{
                        background: aiAccepted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        padding: '8px',
                        borderRadius: '50%',
                        color: aiAccepted ? '#10b981' : '#f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '2px'
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          {aiAccepted ? (
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" />
                          ) : (
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
                          )}
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                          {aiAccepted ? 'AI Smart Routing Applied' : 'AI Routing Suggestion'}
                        </h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                          {aiAccepted ? (
                            <span>Automatically routed to the <strong>{aiRecommendation.departmentName}</strong> department &raquo; <strong>{aiRecommendation.categoryName}</strong> category (Confidence: <strong>{(aiRecommendation.confidence * 100).toFixed(0)}%</strong>).</span>
                          ) : (
                            <span>We suggest routing this complaint to <strong>{aiRecommendation.departmentName}</strong> &raquo; <strong>{aiRecommendation.categoryName}</strong> (Confidence: <strong>{(aiRecommendation.confidence * 100).toFixed(0)}%</strong>).</span>
                          )}
                        </p>
                        {aiRecommendation.reasoning && (
                          <p style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                            Reasoning: "{aiRecommendation.reasoning}"
                          </p>
                        )}
                        
                        {!aiAccepted && (
                          <button 
                            type="button"
                            onClick={acceptRecommendation}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              backgroundColor: 'rgba(99, 102, 241, 0.1)',
                              color: 'var(--accent-color)',
                              border: '1px solid rgba(99, 102, 241, 0.2)',
                              borderRadius: 'var(--border-radius-sm)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(99, 102, 241, 0.18)'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(99, 102, 241, 0.1)'}
                          >
                            Accept Suggestion
                          </button>
                        )}
                      </div>
                    </div>

                    {showOverridePrompt && (
                      <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                        <label className="form-label" style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                          Reason for Override *
                        </label>
                        <textarea
                          className="form-control"
                          rows="2"
                          placeholder="Please explain why you prefer a different department or category than recommended by the AI..."
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          required={showOverridePrompt}
                          style={{ fontSize: '13px' }}
                        />
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Dynamic Custom Fields Renderer */}
            {selectedFields.length > 0 && (
              <div 
                style={{ 
                  marginTop: '24px', 
                  borderTop: '1px solid var(--border-color)', 
                  paddingTop: '24px', 
                  marginBottom: '20px',
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '16px' 
                }}
              >
                <div style={{ gridColumn: 'span 2', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Custom Form Fields (Details Required)
                </div>
                
                {selectedFields.map((field) => (
                  <div key={field._id || field.label} className="form-group" style={{ gridColumn: 'span 1' }}>
                    <label className="form-label">
                      {field.label} {field.required && '*'}
                    </label>
                    
                    {field.type === 'select' ? (
                      <select 
                        className="form-control"
                        value={customFields[field.label] || ''}
                        onChange={(e) => setCustomFields({ ...customFields, [field.label]: e.target.value })}
                        required={field.required}
                      >
                        <option value="">-- Choose Option --</option>
                        {field.options.map((opt, oIdx) => (
                          <option key={oIdx} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type={field.type === 'number' ? 'number' : 'text'}
                        className="form-control"
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        value={customFields[field.label] || ''}
                        onChange={(e) => setCustomFields({ ...customFields, [field.label]: e.target.value })}
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Supporting Attachments (Max 5)</label>
              <div 
                className={`file-drag-area ${dragOver ? 'dragover' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  multiple
                  accept=".png,.jpg,.jpeg,.pdf"
                />
                <Upload size={32} className="file-drag-icon" style={{ margin: '0 auto 12px auto' }} />
                <div style={{ fontSize: '15px', fontWeight: 600 }}>Drag & Drop files here or click to browse</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Images (PNG, JPG) and PDF documents under 5MB are accepted
                </div>
              </div>

              {/* Selected files preview */}
              {files.length > 0 && (
                <div className="preview-grid">
                  {files.map((file, index) => {
                    const isImage = file.type.startsWith('image/');
                    return (
                      <div key={index} className="preview-item">
                        {isImage ? (
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt="preview" 
                            className="preview-image"
                          />
                        ) : (
                          <div className="preview-doc">
                            <File size={24} style={{ marginBottom: '4px' }} />
                            <span>PDF Doc</span>
                          </div>
                        )}
                        <button 
                          type="button" 
                          className="preview-remove" 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-block" 
              disabled={isSubmitting}
              style={{ marginTop: '16px' }}
            >
              {isSubmitting ? 'Submitting ticket...' : 'File Official Ticket'}
            </button>
          </form>
        )}
      </div>

      {/* Duplicate View/Join Modal */}
      {showDuplicateModal && selectedDuplicate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius-lg)',
            width: '90%',
            maxWidth: '600px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Similar Complaint Details - {selectedDuplicate.trackingId}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setSelectedDuplicate(null);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px' }}>
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Title</strong>
                <span style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600 }}>{selectedDuplicate.title}</span>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Match Confidence</strong>
                <span style={{ 
                  fontSize: '13px', 
                  fontWeight: 700, 
                  color: selectedDuplicate.similarityScore >= 0.95 ? '#ef4444' : '#f59e0b' 
                }}>
                  {(selectedDuplicate.similarityScore * 100).toFixed(0)}% Similarity ({selectedDuplicate.matchLevel})
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department</strong>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{selectedDuplicate.department}</span>
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</strong>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{selectedDuplicate.status}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Supporters Count</strong>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{selectedDuplicate.supporterCount || 0} affected users</span>
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filed On</strong>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{new Date(selectedDuplicate.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
                <label className="form-label" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                  Remarks / How this affects you (Optional)
                </label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Provide comments to support this ticket and help speed up its resolution..."
                  value={joinRemarks}
                  onChange={(e) => setJoinRemarks(e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setSelectedDuplicate(null);
                }}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/duplicates/${selectedDuplicate.complaintId}/join`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${user.token}`
                      },
                      body: JSON.stringify({ remarks: joinRemarks })
                    });
                    const json = await res.json();
                    if (json.success) {
                      addToast('Joined Complaint', `You have successfully joined as a supporter of ticket ${selectedDuplicate.trackingId}.`, 'success');
                      setShowDuplicateModal(false);
                      setSelectedDuplicate(null);
                      navigate('/');
                    } else {
                      addToast('Join Failed', json.message || 'Could not join complaint', 'error');
                    }
                  } catch (err) {
                    console.error('Error joining complaint:', err);
                    addToast('Error', 'Communication failure with server', 'error');
                  }
                }}
                style={{ padding: '8px 16px' }}
              >
                Join Complaint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileComplaint;
