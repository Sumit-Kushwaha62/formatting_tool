import React from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';

export default function Activity({ navTo }) {
  const { user } = useAuth();
  const [documents, setDocuments] = React.useState([]);

  React.useEffect(() => {
    if (!user?.id) return;

    supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching activity:', error);
          return;
        }
        setDocuments(data || []);
      });
  }, [user?.id]);

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <div className="dash-page-title">Activity</div>
      <div className="dash-page-sub">Your complete document formatting history.</div>
      
      <div className="activity-list">
        {documents.length > 0 ? (
          documents.map((doc, i) => {
            const icon = doc.doc_type === 'book' ? '📖' : doc.doc_type === 'thesis' ? '🎓' : doc.doc_type === 'research' ? '🔬' : '✉️';
            const name = `${doc.doc_type.charAt(0).toUpperCase() + doc.doc_type.slice(1)} — ${doc.file_name}`;
            return (
              <div className="activity-row" key={doc.id || i}>
                <div className="activity-icon">{icon}</div>
                <div>
                  <div className="activity-name">{name}</div>
                  <div className="activity-meta">{formatDate(doc.created_at)}</div>
                </div>
                <div className="activity-spacer" />
                <span className={`activity-badge ${doc.status === 'done' ? 'badge-done' : 'badge-fail'}`}>
                  {doc.status === 'done' ? 'Success' : 'Failed'}
                </span>
              </div>
            );
          })
        ) : (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)', fontFamily: "'DM Sans', sans-serif", fontSize: '13px' }}>
            No formatted documents found.
            <div style={{ marginTop: '12px' }}>
              <button className="btn-primary" onClick={() => navTo('tool')}>
                Format Document Now
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
