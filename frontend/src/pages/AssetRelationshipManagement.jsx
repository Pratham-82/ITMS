import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Plus, Trash, GitBranch, Save, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';

const RELATIONSHIP_TYPES = [
  'Runs On',
  'Connected To',
  'Depends On',
  'Installed On',
  'Owned By',
  'Backed Up By'
];

const AssetRelationshipManagement = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [relationships, setRelationships] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [sourceAssetId, setSourceAssetId] = useState('');
  const [targetAssetId, setTargetAssetId] = useState('');
  const [relationshipType, setRelationshipType] = useState(RELATIONSHIP_TYPES[0]);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/assets?limit=100', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setAssets(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch assets for relationships', err);
    }
  };

  const fetchRelationships = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/asset-relationships', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setRelationships(result.data || []);
      } else {
        addToast('Error', result.message || 'Failed to fetch relationships', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchAssets();
      fetchRelationships();
    }
  }, [user]);

  const resetForm = () => {
    setSourceAssetId('');
    setTargetAssetId('');
    setRelationshipType(RELATIONSHIP_TYPES[0]);
    setDescription('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sourceAssetId || !targetAssetId) {
      addToast('Validation Error', 'Please select both source and target assets', 'error');
      return;
    }
    if (sourceAssetId === targetAssetId) {
      addToast('Validation Error', 'An asset cannot form a relationship with itself', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/asset-relationships', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          sourceAssetId,
          targetAssetId,
          relationshipType,
          description: description.trim()
        })
      });

      const result = await response.json();
      if (result.success) {
        addToast('Success', 'Asset relationship established successfully', 'success');
        resetForm();
        fetchRelationships();
      } else {
        addToast('Error', result.message || 'Failed to save relationship', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to connect to server', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (rel) => {
    if (!window.confirm('Are you sure you want to delete this relationship? Topology mapping will be updated immediately.')) return;

    try {
      const response = await fetch(`/api/asset-relationships/${rel._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        addToast('Deleted', 'Relationship removed successfully', 'success');
        fetchRelationships();
      } else {
        addToast('Failed', result.message || 'Error deleting relationship', 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to reach server', 'error');
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 style={{ fontWeight: 800, fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitBranch className="text-accent" size={22} />
            Asset Relationships & CMDB Topology
          </h3>
          <p className="text-muted" style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
            Map relationships between your configuration items (e.g., Application X "Runs On" Server Y).
          </p>
        </div>
        <button className="sh-wizard-btn d-flex align-items-center gap-2" onClick={fetchRelationships} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="row">
        {/* Creation Form */}
        <div className="col-md-4 mb-4">
          <div className="card-custom" style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h4 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '20px', color: 'var(--text-primary)' }}>
              Link Configuration Items
            </h4>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Source Asset</label>
                <select
                  className="form-control"
                  value={sourceAssetId}
                  onChange={(e) => setSourceAssetId(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px' }}
                  required
                >
                  <option value="">-- Select Source --</option>
                  {assets.map((a) => (
                    <option key={a._id} value={a._id}>[{a.assetCode}] {a.name} ({a.assetTypeId?.name || 'Asset'})</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Relationship Type</label>
                <select
                  className="form-control"
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px' }}
                  required
                >
                  {RELATIONSHIP_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Target Asset</label>
                <select
                  className="form-control"
                  value={targetAssetId}
                  onChange={(e) => setTargetAssetId(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px' }}
                  required
                >
                  <option value="">-- Select Target --</option>
                  {assets.map((a) => (
                    <option key={a._id} value={a._id}>[{a.assetCode}] {a.name} ({a.assetTypeId?.name || 'Asset'})</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Relationship Description</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Virtualized inside VM host machine"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
                disabled={isSaving}
                style={{
                  backgroundColor: 'var(--accent-color)',
                  borderColor: 'var(--accent-color)',
                  fontWeight: 700,
                  borderRadius: '8px',
                  padding: '10px',
                  boxShadow: '0 2px 8px var(--accent-glow)'
                }}
              >
                <Save size={16} />
                {isSaving ? 'Establishing Link...' : 'Link Assets'}
              </button>
            </form>
          </div>
        </div>

        {/* Existing Topology List */}
        <div className="col-md-8">
          {loading && relationships.length === 0 ? (
            <div className="text-center p-5">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : relationships.length === 0 ? (
            <div className="card-custom text-center p-5" style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px'
            }}>
              <GitBranch size={40} className="text-muted mb-3" />
              <h5 style={{ fontWeight: 700 }}>No relationships mapped</h5>
              <p className="text-muted" style={{ fontSize: '13px' }}>Define link connections using the form panel.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              {relationships.map((rel) => (
                <div
                  key={rel._id}
                  className="card-custom d-flex justify-content-between align-items-center"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '18px 24px',
                    boxShadow: 'var(--box-shadow-sm)'
                  }}
                >
                  <div className="d-flex align-items-center gap-3 flex-grow-1">
                    {/* Source Asset */}
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <span className="text-muted" style={{ fontSize: '10.5px', display: 'block', fontWeight: 600 }}>Source Asset</span>
                      <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>
                        {rel.sourceAssetId ? rel.sourceAssetId.name : '(Deleted Asset)'}
                      </strong>
                      {rel.sourceAssetId && (
                        <div style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: 700 }}>
                          {rel.sourceAssetId.assetCode} • {rel.sourceAssetId.assetTypeId?.name || 'Asset'}
                        </div>
                      )}
                    </div>

                    {/* Transition Connector Badge */}
                    <div className="d-flex flex-column align-items-center" style={{ minWidth: '120px' }}>
                      <ArrowRight size={14} className="text-accent" />
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '2px 10px',
                        color: 'var(--text-primary)',
                        marginTop: '4px',
                        textAlign: 'center'
                      }}>
                        {rel.relationshipType}
                      </span>
                    </div>

                    {/* Target Asset */}
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <span className="text-muted" style={{ fontSize: '10.5px', display: 'block', fontWeight: 600 }}>Target Asset</span>
                      <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>
                        {rel.targetAssetId ? rel.targetAssetId.name : '(Deleted Asset)'}
                      </strong>
                      {rel.targetAssetId && (
                        <div style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: 700 }}>
                          {rel.targetAssetId.assetCode} • {rel.targetAssetId.assetTypeId?.name || 'Asset'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-3 ms-3">
                    {rel.description && (
                      <div className="text-muted d-none d-lg-block" style={{ fontSize: '11.5px', maxWidth: '180px', borderLeft: '2px solid var(--border-color)', paddingLeft: '10px' }} title={rel.description}>
                        {rel.description}
                      </div>
                    )}

                    <button
                      onClick={() => handleDelete(rel)}
                      className="btn btn-icon p-1"
                      title="Remove Relationship"
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <Trash size={15} className="text-danger-hover" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetRelationshipManagement;
