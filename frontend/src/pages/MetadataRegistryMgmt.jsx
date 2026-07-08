import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Plus, Trash2, Database, ShieldAlert, ArrowLeft, Activity, FileText, Check, X, Layers, Lock, GitBranch
} from 'lucide-react';
import '../styles/MetadataRegistryMgmt.css';

const MetadataRegistryMgmt = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('entities'); // 'entities' | 'types' | 'audit'
  const [activeDetailTab, setActiveDetailTab] = useState('fields'); // 'fields' | 'relationships'

  // Metadata arrays
  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [fields, setFields] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [globalTypes, setGlobalTypes] = useState([]);
  const [audits, setAudits] = useState([]);

  // Loaders
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal displays
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showRelModal, setShowRelModal] = useState(false);

  // Forms states - Entity
  const [entityCode, setEntityCode] = useState('');
  const [entityName, setEntityName] = useState('');
  const [entityPlural, setEntityPlural] = useState('');
  const [entityDesc, setEntityDesc] = useState('');
  const [entityCategory, setEntityCategory] = useState('Core');
  const [entityIcon, setEntityIcon] = useState('Layers');
  const [entityColor, setEntityColor] = useState('#6366f1');
  const [supportsWorkflow, setSupportsWorkflow] = useState(false);
  const [supportsApproval, setSupportsApproval] = useState(false);
  const [supportsComments, setSupportsComments] = useState(false);
  const [supportsAttachments, setSupportsAttachments] = useState(false);
  const [supportsAudit, setSupportsAudit] = useState(false);

  // Forms states - Field
  const [fieldKey, setFieldKey] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldUnique, setFieldUnique] = useState(false);
  const [fieldDefault, setFieldDefault] = useState('');
  const [fieldSearchable, setFieldSearchable] = useState(true);
  const [fieldSortable, setFieldSortable] = useState(true);
  const [fieldFilterable, setFieldFilterable] = useState(true);
  const [fieldOrder, setFieldOrder] = useState(0);
  // Reference Configuration
  const [refEntity, setRefEntity] = useState('');
  const [refDisplayField, setRefDisplayField] = useState('');
  // Display Rules (conditional display)
  const [hasDisplayRule, setHasDisplayRule] = useState(false);
  const [dependsOnField, setDependsOnField] = useState('');
  const [dependsOnOperator, setDependsOnOperator] = useState('eq');
  const [dependsOnValue, setDependsOnValue] = useState('');

  // Forms states - Relationship
  const [relTarget, setRelTarget] = useState('');
  const [relType, setRelType] = useState('links_to');
  const [relCardinality, setRelCardinality] = useState('many-to-one');
  const [relLabel, setRelLabel] = useState('');
  const [relRequired, setRelRequired] = useState(false);

  // Fetch initial data on mount
  useEffect(() => {
    if (user?.token) {
      fetchInitialData();
    }
  }, [user]);

  // Fetch sub-tab details when switching tabs
  useEffect(() => {
    if (!user?.token) return;
    if (activeTab === 'audit') fetchAudits();
    if (activeTab === 'types') fetchGlobalTypes();
  }, [activeTab, user]);

  // Fetch schema elements when selecting an entity
  useEffect(() => {
    if (selectedEntity && user?.token) {
      fetchEntitySchema(selectedEntity.code);
    }
  }, [selectedEntity, user]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/metadata/entities', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        setEntities(json.data || []);
      }
    } catch (err) {
      addToast('Error', 'Failed to retrieve entity definitions from server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchEntitySchema = async (code) => {
    try {
      const headers = { Authorization: `Bearer ${user.token}` };
      const [fieldsRes, relsRes] = await Promise.all([
        fetch(`/api/metadata/fields?entityCode=${code}`, { headers }).then(r => r.json()),
        fetch(`/api/metadata/relationships?entityCode=${code}`, { headers }).then(r => r.json())
      ]);

      if (fieldsRes.success) setFields(fieldsRes.data || []);
      if (relsRes.success) setRelationships(relsRes.data || []);
    } catch (err) {
      addToast('Error', 'Failed to retrieve fields and relationships schema.', 'error');
    }
  };

  const fetchGlobalTypes = async () => {
    try {
      const res = await fetch('/api/tenants', { // Reuse system checks or config fetch if globalTypes is private. Since MetadataType is loaded from defaults, let's fetch via metadata endpoint. Wait, does MetadataType have an endpoint? We seeded it, but let's query it. Wait! Since we don't have a direct /api/metadata/types endpoint, let's mock it using default categories or read from API if it existed. Wait, let's look at what endpoints we created in metadataRoutes.js.
      // Ah! We didn't mount a GET /api/metadata/types route. But we have MetadataTypes seeded. That's fine, we can show a list of seeded types locally in UI since they are hardcoded system definitions! That is safer and avoids extra server overhead.
      });
      setGlobalTypes([
        { code: 'ENTITY', name: 'Entity Definition' },
        { code: 'FIELD', name: 'Field Definition' },
        { code: 'RELATIONSHIP', name: 'Relationship Definition' },
        { code: 'FORM', name: 'Form Definition' },
        { code: 'VIEW', name: 'View Definition' },
        { code: 'WORKFLOW', name: 'Workflow Definition' },
        { code: 'AUTOMATION', name: 'Automation Definition' },
        { code: 'RULE', name: 'Validation Rule' },
        { code: 'DASHBOARD', name: 'Dashboard Definition' },
        { code: 'REPORT', name: 'Report Definition' }
      ]);
    } catch (e) {}
  };

  const fetchAudits = async () => {
    try {
      const res = await fetch('/api/metadata/audit', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        setAudits(json.data || []);
      }
    } catch (err) {
      addToast('Error', 'Failed to retrieve registry audit trails.', 'error');
    }
  };

  // ==========================================
  // FORM MUTATIONS (CREATE/DELETE)
  // ==========================================

  const handleCreateEntity = async (e) => {
    e.preventDefault();
    if (!entityCode.trim() || !entityName.trim()) {
      addToast('Validation Error', 'Module Code and Name are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/metadata/entities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          code: entityCode.trim().toUpperCase(),
          name: entityName.trim(),
          pluralName: entityPlural.trim() || undefined,
          description: entityDesc.trim(),
          category: entityCategory,
          icon: entityIcon,
          color: entityColor,
          supportsWorkflow,
          supportsApproval,
          supportsComments,
          supportsAttachments,
          supportsAudit
        })
      });
      const json = await res.json();
      if (json.success) {
        addToast('Module Created', `Custom module "${entityName}" defined successfully.`, 'success');
        setShowEntityModal(false);
        resetEntityForm();
        fetchInitialData();
      } else {
        addToast('Error', json.message || 'Failed to create custom module.', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntity = async (code) => {
    if (!window.confirm(`Are you absolutely sure you want to delete custom module "${code}"?\nThis will permanently clean up all its associated fields, relationships, and cache configurations.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/metadata/entities/${code}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        addToast('Module Deleted', `Module "${code}" deleted successfully.`, 'success');
        setSelectedEntity(null);
        fetchInitialData();
      } else {
        addToast('Error', json.message || 'Deletion blocked.', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure.', 'error');
    }
  };

  const handleCreateField = async (e) => {
    e.preventDefault();
    if (!fieldKey.trim() || !fieldLabel.trim()) {
      addToast('Validation Error', 'Field Key and Label are required.', 'error');
      return;
    }

    // Build payload
    const payload = {
      entityCode: selectedEntity.code,
      fieldKey: fieldKey.trim(),
      fieldLabel: fieldLabel.trim(),
      fieldType,
      required: fieldRequired,
      unique: fieldUnique,
      defaultValue: fieldDefault || undefined,
      searchable: fieldSearchable,
      sortable: fieldSortable,
      filterable: fieldFilterable,
      order: Number(fieldOrder) || 0
    };

    if (fieldType === 'reference') {
      if (!refEntity || !refDisplayField) {
        addToast('Validation Error', 'Lookups require target referenced entity and label key.', 'error');
        return;
      }
      payload.referenceConfig = { referencedEntity: refEntity.toUpperCase(), displayField: refDisplayField };
    }

    if (hasDisplayRule && dependsOnField.trim()) {
      payload.displayRules = [{
        dependsOnField: dependsOnField.trim(),
        operator: dependsOnOperator,
        value: dependsOnValue
      }];
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/metadata/fields', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        addToast('Field Created', `Field "${fieldLabel}" added to module.`, 'success');
        setShowFieldModal(false);
        resetFieldForm();
        fetchEntitySchema(selectedEntity.code);
      } else {
        addToast('Error', json.message || 'Failed to define field.', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteField = async (fieldKey) => {
    if (!window.confirm(`Delete field "${fieldKey}"?`)) return;

    try {
      const res = await fetch(`/api/metadata/fields/${selectedEntity.code}/${fieldKey}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        addToast('Field Deleted', `Field "${fieldKey}" deleted.`, 'success');
        fetchEntitySchema(selectedEntity.code);
      } else {
        addToast('Error', json.message || 'Deletion blocked.', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure.', 'error');
    }
  };

  const handleCreateRelationship = async (e) => {
    e.preventDefault();
    if (!relTarget || !relLabel.trim()) {
      addToast('Validation Error', 'Target module and link description are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/metadata/relationships', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          sourceEntity: selectedEntity.code,
          targetEntity: relTarget,
          relationshipType: relType,
          cardinality: relCardinality,
          label: relLabel.trim(),
          isRequired: relRequired
        })
      });
      const json = await res.json();
      if (json.success) {
        addToast('Relationship Configured', 'Entity relationship linked successfully.', 'success');
        setShowRelModal(false);
        resetRelForm();
        fetchEntitySchema(selectedEntity.code);
      } else {
        addToast('Error', json.message || 'Failed to bind relationship.', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRelationship = async (id) => {
    if (!window.confirm('Delete this relationship association?')) return;

    try {
      const res = await fetch(`/api/metadata/relationships/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        addToast('Relationship Removed', 'Relationship association removed.', 'success');
        fetchEntitySchema(selectedEntity.code);
      } else {
        addToast('Error', json.message || 'Failed to delete relationship.', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure.', 'error');
    }
  };

  // ==========================================
  // HELPERS & RESETTERS
  // ==========================================

  const resetEntityForm = () => {
    setEntityCode('');
    setEntityName('');
    setEntityPlural('');
    setEntityDesc('');
    setEntityCategory('Core');
    setEntityIcon('Layers');
    setEntityColor('#6366f1');
    setSupportsWorkflow(false);
    setSupportsApproval(false);
    setSupportsComments(false);
    setSupportsAttachments(false);
    setSupportsAudit(false);
  };

  const resetFieldForm = () => {
    setFieldKey('');
    setFieldLabel('');
    setFieldType('text');
    setFieldRequired(false);
    setFieldUnique(false);
    setFieldDefault('');
    setFieldSearchable(true);
    setFieldSortable(true);
    setFieldFilterable(true);
    setFieldOrder(0);
    setRefEntity('');
    setRefDisplayField('');
    setHasDisplayRule(false);
    setDependsOnField('');
    setDependsOnOperator('eq');
    setDependsOnValue('');
  };

  const resetRelForm = () => {
    setRelTarget('');
    setRelType('links_to');
    setRelCardinality('many-to-one');
    setRelLabel('');
    setRelRequired(false);
  };

  // ==========================================
  // RENDER BLOCKS
  // ==========================================

  const renderEntitiesGrid = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          Fetching active registry definitions...
        </div>
      );
    }

    return (
      <div className="mrm-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Entity Modules Registry</h3>
            <p className="text-muted" style={{ fontSize: '12.5px', marginTop: '4px', marginBottom: 0 }}>
              Blueprint directory of core structures. System modules are protected.
            </p>
          </div>
          <button
            onClick={() => setShowEntityModal(true)}
            className="scm-btn scm-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px' }}
          >
            <Plus size={15} /> Create Custom Module
          </button>
        </div>

        <div className="mrm-entity-grid">
          {entities.map((ent) => (
            <div
              key={ent.code}
              onClick={() => setSelectedEntity(ent)}
              className="mrm-entity-card"
            >
              <div>
                <div className="mrm-card-header">
                  <div className="mrm-card-icon" style={{ backgroundColor: ent.color || '#6366f1' }}>
                    <Layers size={18} />
                  </div>
                  <div>
                    <span className="mrm-entity-code">{ent.code}</span>
                    <span className="mrm-entity-name">{ent.name}</span>
                  </div>
                </div>
                <p className="mrm-entity-desc">
                  {ent.description || 'No descriptive guide added.'}
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  <span>Category: <strong>{ent.category}</strong></span>
                  <span>Ver. <strong>{ent.version}</strong></span>
                </div>
                <div className="mrm-features-row">
                  <span className={`mrm-feature-badge ${ent.supportsWorkflow ? 'active' : ''}`}>Workflow</span>
                  <span className={`mrm-feature-badge ${ent.supportsApproval ? 'active' : ''}`}>Approval</span>
                  <span className={`mrm-feature-badge ${ent.supportsAudit ? 'active' : ''}`}>Audit</span>
                </div>
              </div>

              {ent.isSystem && (
                <span className="mrm-system-indicator">
                  <Lock size={10} style={{ marginRight: '3px' }} /> System
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEntityDetail = () => {
    return (
      <div className="mrm-detail-layout">
        <div className="mrm-detail-header-card">
          <button onClick={() => setSelectedEntity(null)} className="mrm-back-btn">
            <ArrowLeft size={14} /> Back to Modules Grid
          </button>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div className="mrm-card-icon" style={{ backgroundColor: selectedEntity.color || '#6366f1', width: '48px', height: '48px', borderRadius: '12px' }}>
                <Layers size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {selectedEntity.name}
                  </h3>
                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', padding: '3px 8px', borderRadius: '4px', fontWeight: 800 }}>
                    CODE: {selectedEntity.code}
                  </span>
                  {selectedEntity.isSystem && (
                    <span style={{ fontSize: '10px', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-color)', border: '1px solid rgba(99,102,241,0.2)', padding: '3px 8px', borderRadius: '4px', fontWeight: 800 }}>
                      SYSTEM LOCKED
                    </span>
                  )}
                </div>
                <p className="text-muted" style={{ fontSize: '13px', marginTop: '6px', marginBottom: 0 }}>
                  {selectedEntity.description || 'No description provided.'}
                </p>
              </div>
            </div>

            {!selectedEntity.isSystem && (
              <button
                onClick={() => handleDeleteEntity(selectedEntity.code)}
                className="scm-btn"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 18px' }}
              >
                Delete Custom Module
              </button>
            )}
          </div>
        </div>

        {/* Details Sub-Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginTop: '8px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={() => setActiveDetailTab('fields')}
              style={{
                background: 'none',
                border: 'none',
                color: activeDetailTab === 'fields' ? 'var(--accent-color)' : 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                paddingBottom: '8px',
                borderBottom: activeDetailTab === 'fields' ? '2px solid var(--accent-color)' : 'none'
              }}
            >
              Fields Schema ({fields.length})
            </button>
            <button
              onClick={() => setActiveDetailTab('relationships')}
              style={{
                background: 'none',
                border: 'none',
                color: activeDetailTab === 'relationships' ? 'var(--accent-color)' : 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                paddingBottom: '8px',
                borderBottom: activeDetailTab === 'relationships' ? '2px solid var(--accent-color)' : 'none'
              }}
            >
              Relationships ({relationships.length})
            </button>
          </div>

          <div>
            {activeDetailTab === 'fields' ? (
              <button onClick={() => setShowFieldModal(true)} className="scm-btn scm-btn-primary" style={{ padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={14} /> Add Custom Field
              </button>
            ) : (
              <button onClick={() => setShowRelModal(true)} className="scm-btn scm-btn-primary" style={{ padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={14} /> Add Relationship
              </button>
            )}
          </div>
        </div>

        {/* Tab Workspaces */}
        {activeDetailTab === 'fields' ? (
          <div className="mrm-table-wrapper">
            <table className="mrm-table">
              <thead>
                <tr>
                  <th>Field Key</th>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Mandatory</th>
                  <th>Unique</th>
                  <th>Order</th>
                  <th>Conditional</th>
                  <th>System</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fields.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No fields configured. Renders as empty database entity.
                    </td>
                  </tr>
                ) : (
                  fields.map((f) => (
                    <tr key={f.fieldKey}>
                      <td><code style={{ fontSize: '12px', color: 'var(--accent-color)' }}>{f.fieldKey}</code></td>
                      <td><strong>{f.fieldLabel}</strong></td>
                      <td><span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.03)', padding: '3px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>{f.fieldType}</span></td>
                      <td>{f.required ? <Check size={16} className="text-success" /> : <X size={16} className="text-muted" />}</td>
                      <td>{f.unique ? <Check size={16} className="text-success" /> : <X size={16} className="text-muted" />}</td>
                      <td>{f.order}</td>
                      <td>
                        {f.displayRules && f.displayRules.length > 0 ? (
                          <span style={{ fontSize: '11px', color: 'var(--accent-color)' }}>Depends on {f.displayRules[0].dependsOnField}</span>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                      <td>
                        {f.isSystem ? (
                          <span style={{ fontSize: '10px', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 800 }}>
                            <Lock size={10} /> Locked
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            Custom
                          </span>
                        )}
                      </td>
                      <td>
                        {!f.isSystem ? (
                          <button onClick={() => handleDeleteField(f.fieldKey)} className="sm-remove-field-btn" title="Delete Field">
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No Action</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mrm-table-wrapper">
            <table className="mrm-table">
              <thead>
                <tr>
                  <th>Origin</th>
                  <th>Cardinality</th>
                  <th>Target</th>
                  <th>Type</th>
                  <th>Label</th>
                  <th>Mandatory</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {relationships.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No relationships bound to this entity.
                    </td>
                  </tr>
                ) : (
                  relationships.map((r) => (
                    <tr key={r._id}>
                      <td><strong style={{ color: r.sourceEntity === selectedEntity.code ? 'var(--accent-color)' : 'var(--text-primary)' }}>{r.sourceEntity}</strong></td>
                      <td><span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.03)', padding: '3px 8px', borderRadius: '4px' }}>{r.cardinality}</span></td>
                      <td><strong style={{ color: r.targetEntity === selectedEntity.code ? 'var(--accent-color)' : 'var(--text-primary)' }}>{r.targetEntity}</strong></td>
                      <td><code>{r.relationshipType}</code></td>
                      <td>{r.label || 'None'}</td>
                      <td>{r.isRequired ? <Check size={16} className="text-success" /> : <X size={16} className="text-muted" />}</td>
                      <td>
                        <button onClick={() => handleDeleteRelationship(r._id)} className="sm-remove-field-btn" title="Delete Relationship Link">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderGlobalTypes = () => {
    return (
      <div className="mrm-container">
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Seeded Metadata Categories</h3>
          <p className="text-muted" style={{ fontSize: '12.5px', marginTop: '4px' }}>
            System-level metadata types used by CMS compilers to index schemas.
          </p>
        </div>

        <div className="mrm-table-wrapper">
          <table className="mrm-table">
            <thead>
              <tr>
                <th>Category Code</th>
                <th>Category Name</th>
                <th>Type Scoping</th>
              </tr>
            </thead>
            <tbody>
              {globalTypes.map((t) => (
                <tr key={t.code}>
                  <td><code style={{ color: 'var(--accent-color)' }}>{t.code}</code></td>
                  <td><strong>{t.name}</strong></td>
                  <td><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>System Reserved Global Schema</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAuditTab = () => {
    return (
      <div className="mrm-container">
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Registry Audit Trail</h3>
          <p className="text-muted" style={{ fontSize: '12.5px', marginTop: '4px' }}>
            Logs tracking structural configuration edits, system updates, and custom creations.
          </p>
        </div>

        <div className="mrm-table-wrapper">
          <table className="mrm-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Target Type</th>
                <th>Target Identifier</th>
                <th>Description</th>
                <th>Author</th>
              </tr>
            </thead>
            <tbody>
              {audits.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No audit records loaded.
                  </td>
                </tr>
              ) : (
                audits.map((a, idx) => (
                  <tr key={idx}>
                    <td style={{ fontSize: '12px' }}>{new Date(a.timestamp).toLocaleString()}</td>
                    <td>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          backgroundColor: a.action === 'CREATE' ? 'rgba(16, 185, 129, 0.1)' : a.action === 'UPDATE' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: a.action === 'CREATE' ? '#10b981' : a.action === 'UPDATE' ? 'var(--accent-color)' : '#ef4444',
                        }}
                      >
                        {a.action}
                      </span>
                    </td>
                    <td><strong>{a.targetType}</strong></td>
                    <td><code>{a.targetCode}</code></td>
                    <td>{a.changeSummary}</td>
                    <td><strong>{a.actor}</strong></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Database size={24} className="text-accent" />
        <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Metadata Registry Console</h2>
      </div>

      {/* Main Tab selector */}
      {!selectedEntity && (
        <div className="mrm-subnav">
          <button onClick={() => setActiveTab('entities')} className={`mrm-nav-btn ${activeTab === 'entities' ? 'active' : ''}`}>
            <Layers size={14} /> Modules Schema
          </button>
          <button onClick={() => setActiveTab('types')} className={`mrm-nav-btn ${activeTab === 'types' ? 'active' : ''}`}>
            <Database size={14} /> Global Types
          </button>
          <button onClick={() => setActiveTab('audit')} className={`mrm-nav-btn ${activeTab === 'audit' ? 'active' : ''}`}>
            <Activity size={14} /> Audit Trail
          </button>
        </div>
      )}

      {/* Tab Render Switcher */}
      {selectedEntity ? renderEntityDetail() : (
        activeTab === 'entities' ? renderEntitiesGrid() :
        activeTab === 'types' ? renderGlobalTypes() :
        renderAuditTab()
      )}

      {/* ==========================================
          ENTITY CREATION MODAL
         ========================================== */}
      {showEntityModal && (
        <div className="mrm-modal-overlay">
          <div className="mrm-modal">
            <div className="mrm-modal-header">
              <h4 style={{ fontWeight: 800, fontSize: '15px', margin: 0 }}>Create Custom Module Blueprint</h4>
              <button onClick={() => setShowEntityModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateEntity}>
              <div className="mrm-modal-body">
                <div className="mrm-form-grid">
                  <div className="sm-input-group">
                    <label>Module Key Code (Uppercase, unique)</label>
                    <input
                      type="text"
                      placeholder="e.g. VENDOR"
                      value={entityCode}
                      onChange={(e) => setEntityCode(e.target.value)}
                      className="sm-input"
                      required
                    />
                  </div>
                  <div className="sm-input-group">
                    <label>Module Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Vendor"
                      value={entityName}
                      onChange={(e) => setEntityName(e.target.value)}
                      className="sm-input"
                      required
                    />
                  </div>
                </div>

                <div className="mrm-form-grid">
                  <div className="sm-input-group">
                    <label>Plural Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Vendors"
                      value={entityPlural}
                      onChange={(e) => setEntityPlural(e.target.value)}
                      className="sm-input"
                    />
                  </div>
                  <div className="sm-input-group">
                    <label>Display Icon</label>
                    <input
                      type="text"
                      placeholder="Layers, Database, User, etc."
                      value={entityIcon}
                      onChange={(e) => setEntityIcon(e.target.value)}
                      className="sm-input"
                    />
                  </div>
                </div>

                <div className="sm-input-group">
                  <label>Descriptive Guide</label>
                  <textarea
                    placeholder="Provide a brief summary of what this module represents..."
                    value={entityDesc}
                    onChange={(e) => setEntityDesc(e.target.value)}
                    className="sm-textarea"
                  />
                </div>

                <div className="mrm-form-grid">
                  <div className="sm-input-group">
                    <label>Category Group</label>
                    <select value={entityCategory} onChange={(e) => setEntityCategory(e.target.value)} className="sm-select">
                      <option value="Core">Core Registry</option>
                      <option value="ITSM">ITSM Automation</option>
                      <option value="CMDB">CMDB Infrastructure</option>
                      <option value="HR">HR & Personnel</option>
                    </select>
                  </div>
                  <div className="sm-input-group">
                    <label>Theme Brand Color</label>
                    <input
                      type="color"
                      value={entityColor}
                      onChange={(e) => setEntityColor(e.target.value)}
                      className="sm-input"
                      style={{ padding: '4px', height: '42px', cursor: 'pointer' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Capability Switches</label>
                  <div className="mrm-checkbox-grid">
                    <label className="sm-checkbox-label">
                      <input type="checkbox" checked={supportsWorkflow} onChange={(e) => setSupportsWorkflow(e.target.checked)} />
                      Supports Workflows
                    </label>
                    <label className="sm-checkbox-label">
                      <input type="checkbox" checked={supportsApproval} onChange={(e) => setSupportsApproval(e.target.checked)} />
                      Needs Approvals
                    </label>
                    <label className="sm-checkbox-label">
                      <input type="checkbox" checked={supportsComments} onChange={(e) => setSupportsComments(e.target.checked)} />
                      Supports Chat Threads
                    </label>
                    <label className="sm-checkbox-label">
                      <input type="checkbox" checked={supportsAttachments} onChange={(e) => setSupportsAttachments(e.target.checked)} />
                      File Attachments
                    </label>
                    <label className="sm-checkbox-label">
                      <input type="checkbox" checked={supportsAudit} onChange={(e) => setSupportsAudit(e.target.checked)} />
                      Audit Trail Logs
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                  <button type="submit" disabled={submitting} className="scm-btn scm-btn-primary" style={{ flex: 1 }}>
                    {submitting ? 'Creating...' : 'Initialize Module'}
                  </button>
                  <button type="button" onClick={() => setShowEntityModal(false)} className="scm-btn scm-btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          FIELD CREATION MODAL
         ========================================== */}
      {showFieldModal && (
        <div className="mrm-modal-overlay">
          <div className="mrm-modal">
            <div className="mrm-modal-header">
              <h4 style={{ fontWeight: 800, fontSize: '15px', margin: 0 }}>Add Custom Field to {selectedEntity.name}</h4>
              <button onClick={() => setShowFieldModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateField}>
              <div className="mrm-modal-body">
                <div className="mrm-form-grid">
                  <div className="sm-input-group">
                    <label>Field Key (CamelCase or lowercase)</label>
                    <input
                      type="text"
                      placeholder="e.g. badgeNumber"
                      value={fieldKey}
                      onChange={(e) => setFieldKey(e.target.value)}
                      className="sm-input"
                      required
                    />
                  </div>
                  <div className="sm-input-group">
                    <label>Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Badge Number"
                      value={fieldLabel}
                      onChange={(e) => setFieldLabel(e.target.value)}
                      className="sm-input"
                      required
                    />
                  </div>
                </div>

                <div className="mrm-form-grid">
                  <div className="sm-input-group">
                    <label>Field Type</label>
                    <select value={fieldType} onChange={(e) => setFieldType(e.target.value)} className="sm-select">
                      <option value="text">Single Line Text</option>
                      <option value="textarea">Multi-line Box</option>
                      <option value="number">Numeric Float/Int</option>
                      <option value="currency">Currency Decimal</option>
                      <option value="boolean">Boolean Switch</option>
                      <option value="date">Calendar Date</option>
                      <option value="datetime">Date & Time</option>
                      <option value="email">Email Verification</option>
                      <option value="phone">Phone Format</option>
                      <option value="url">Web Link URL</option>
                      <option value="select">Dropdown Choice</option>
                      <option value="reference">Reference Lookup</option>
                      <option value="user">User Accounts Reference</option>
                      <option value="richtext">Rich Text Content</option>
                      <option value="attachment">Attachment File</option>
                    </select>
                  </div>
                  <div className="sm-input-group">
                    <label>Display Order Priority</label>
                    <input
                      type="number"
                      value={fieldOrder}
                      onChange={(e) => setFieldOrder(e.target.value)}
                      className="sm-input"
                    />
                  </div>
                </div>

                {/* Reference lookup settings config */}
                {fieldType === 'reference' && (
                  <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '20px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-color)', display: 'block', marginBottom: '12px' }}>LOOKUP SCHEMATIC REFERENCE</span>
                    <div className="mrm-form-grid">
                      <div className="sm-input-group">
                        <label>Referenced Entity Code</label>
                        <select value={refEntity} onChange={(e) => setRefEntity(e.target.value)} className="sm-select" required>
                          <option value="">-- Choose Module --</option>
                          {entities.map(e => <option key={e.code} value={e.code}>{e.name} ({e.code})</option>)}
                        </select>
                      </div>
                      <div className="sm-input-group">
                        <label>Display Field Name Key</label>
                        <input
                          type="text"
                          placeholder="e.g. name, title, code"
                          value={refDisplayField}
                          onChange={(e) => setRefDisplayField(e.target.value)}
                          className="sm-input"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="sm-input-group">
                  <label>Default Value</label>
                  <input
                    type="text"
                    placeholder="Optional default schema value..."
                    value={fieldDefault}
                    onChange={(e) => setFieldDefault(e.target.value)}
                    className="sm-input"
                  />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <label className="sm-checkbox-label">
                    <input type="checkbox" checked={fieldRequired} onChange={(e) => setFieldRequired(e.target.checked)} />
                    Mandatory field
                  </label>
                  <label className="sm-checkbox-label">
                    <input type="checkbox" checked={fieldUnique} onChange={(e) => setFieldUnique(e.target.checked)} />
                    Unique value constraint
                  </label>
                  <label className="sm-checkbox-label">
                    <input type="checkbox" checked={fieldSearchable} onChange={(e) => setFieldSearchable(e.target.checked)} />
                    Searchable
                  </label>
                  <label className="sm-checkbox-label">
                    <input type="checkbox" checked={fieldFilterable} onChange={(e) => setFieldFilterable(e.target.checked)} />
                    Filterable
                  </label>
                </div>

                {/* Conditional Display Rules */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <label className="sm-checkbox-label" style={{ fontWeight: 800, marginBottom: '12px' }}>
                    <input type="checkbox" checked={hasDisplayRule} onChange={(e) => setHasDisplayRule(e.target.checked)} />
                    + Add Conditional Display Rule (UI display logic)
                  </label>
                  
                  {hasDisplayRule && (
                    <div className="mrm-form-grid" style={{ animation: 'fadeIn 0.25s ease-out' }}>
                      <div className="sm-input-group">
                        <label>Depends on Field Key</label>
                        <select value={dependsOnField} onChange={(e) => setDependsOnField(e.target.value)} className="sm-select" required>
                          <option value="">-- Select Field --</option>
                          {fields.map(f => <option key={f.fieldKey} value={f.fieldKey}>{f.fieldLabel}</option>)}
                        </select>
                      </div>
                      <div className="sm-input-group">
                        <label>Condition Match</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select value={dependsOnOperator} onChange={(e) => setDependsOnOperator(e.target.value)} className="sm-select" style={{ flex: 1 }}>
                            <option value="eq">equals (==)</option>
                            <option value="ne">not equals (!=)</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Value"
                            value={dependsOnValue}
                            onChange={(e) => setDependsOnValue(e.target.value)}
                            className="sm-input"
                            style={{ flex: 1.5 }}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                  <button type="submit" disabled={submitting} className="scm-btn scm-btn-primary" style={{ flex: 1 }}>
                    {submitting ? 'Adding...' : 'Add Field'}
                  </button>
                  <button type="button" onClick={() => setShowFieldModal(false)} className="scm-btn scm-btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          RELATIONSHIP CREATION MODAL
         ========================================== */}
      {showRelModal && (
        <div className="mrm-modal-overlay">
          <div className="mrm-modal">
            <div className="mrm-modal-header">
              <h4 style={{ fontWeight: 800, fontSize: '15px', margin: 0 }}>Configure Logical Relationship</h4>
              <button onClick={() => setShowRelModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateRelationship}>
              <div className="mrm-modal-body">
                <div className="sm-input-group">
                  <label>Source Entity</label>
                  <input type="text" className="sm-input" value={`${selectedEntity.name} (${selectedEntity.code})`} disabled />
                </div>

                <div className="mrm-form-grid">
                  <div className="sm-input-group">
                    <label>Target Referenced Entity</label>
                    <select value={relTarget} onChange={(e) => setRelTarget(e.target.value)} className="sm-select" required>
                      <option value="">-- Choose Target Module --</option>
                      {entities.filter(e => e.code !== selectedEntity.code).map(e => (
                        <option key={e.code} value={e.code}>{e.name} ({e.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm-input-group">
                    <label>Cardinality mapping</label>
                    <select value={relCardinality} onChange={(e) => setRelCardinality(e.target.value)} className="sm-select">
                      <option value="many-to-one">Many to One (e.g. Employee belongs to Office)</option>
                      <option value="one-to-many">One to Many (e.g. Office has employees)</option>
                      <option value="one-to-one">One to One (e.g. Employee has Badge)</option>
                      <option value="many-to-many">Many to Many</option>
                    </select>
                  </div>
                </div>

                <div className="mrm-form-grid">
                  <div className="sm-input-group">
                    <label>Relationship Label</label>
                    <input
                      type="text"
                      placeholder="e.g. works_at, deployed_in"
                      value={relLabel}
                      onChange={(e) => setRelLabel(e.target.value)}
                      className="sm-input"
                      required
                    />
                  </div>
                  <div className="sm-input-group">
                    <label>Relationship Type</label>
                    <input
                      type="text"
                      placeholder="e.g. located_at, manages"
                      value={relType}
                      onChange={(e) => setRelType(e.target.value)}
                      className="sm-input"
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label className="sm-checkbox-label">
                    <input type="checkbox" checked={relRequired} onChange={(e) => setRelRequired(e.target.checked)} />
                    Mandatory relationship linkage
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                  <button type="submit" disabled={submitting} className="scm-btn scm-btn-primary" style={{ flex: 1 }}>
                    {submitting ? 'Linking...' : 'Create Link'}
                  </button>
                  <button type="button" onClick={() => setShowRelModal(false)} className="scm-btn scm-btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetadataRegistryMgmt;
