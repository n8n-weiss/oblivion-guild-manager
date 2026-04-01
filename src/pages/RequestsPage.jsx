import React from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { writeAuditLog } from '../utils/audit';

function RequestsPage() {
  const { requests, approveRequest, rejectRequest, deleteRequest, clearProcessedRequests, isAdmin, isOfficer, isArchitect, members, currentUser } = useGuild();
  
  const pendingRequests = requests.filter(r => r.status === "pending");
  const processedRequests = requests.filter(r => r.status !== "pending").slice(0, 20);

  const handleApprove = async (r) => {
    const success = await approveRequest(r.id);
    if (success) {
      await writeAuditLog(
        currentUser.email,
        currentUser.displayName || currentUser.email,
        "profile_request_approved",
        `Approved profile change for ${r.requesterIgn} (Member ID: ${r.memberId})`
      );
    }
  };

  const handleReject = async (r) => {
    const success = await rejectRequest(r.id);
    if (success) {
      await writeAuditLog(
        currentUser.email,
        currentUser.displayName || currentUser.email,
        "profile_request_rejected",
        `Rejected profile change for ${r.requesterIgn} (Member ID: ${r.memberId})`
      );
    }
  };

  const handleDelete = async (r) => {
    const success = await deleteRequest(r.id);
    if (success) {
      await writeAuditLog(
        currentUser.email,
        currentUser.displayName || currentUser.email,
        "profile_request_deleted",
        `Deleted processed request history for ${r.requesterIgn} (Member ID: ${r.memberId})`
      );
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear ALL processed request history? This cannot be undone.")) return;
    const success = await clearProcessedRequests();
    if (success) {
      await writeAuditLog(
        currentUser.email,
        currentUser.displayName || currentUser.email,
        "profile_requests_cleared",
        `Cleared all processed profile request history`
      );
    }
  };

  if (!isOfficer) {
    return <div className="p-8 text-center text-muted">Access Denied. Officers only.</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">📝 Change Requests</h1>
        <p className="page-subtitle">Review and approve member profile updates</p>
      </div>

      <div className="card mb-8">
        <div className="card-title flex items-center gap-2">
          <Icon name="clock" size={18} className="text-accent" />
          Pending Requests ({pendingRequests.length})
        </div>
        
        {pendingRequests.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-text">No pending requests. All clear!</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Current Info</th>
                  <th>Requested Change</th>
                  <th>Date Requested</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map(r => {
                  const mIndex = members.findIndex(m => m.memberId === r.memberId);
                  const isIgnChange = r.oldData.ign !== r.newData.ign;
                  const isClassChange = r.oldData.class !== r.newData.class;
                  const isRoleChange = r.oldData.role !== r.newData.role;

                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <MemberAvatar ign={r.requesterIgn} index={mIndex} size={36} />
                          <div>
                            <div className="font-bold text-primary">{r.requesterIgn}</div>
                            <div className="text-xs text-muted">{r.memberId}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="text-xs text-muted leading-relaxed">
                          <div>IGN: {r.oldData.ign}</div>
                          <div>Class: {r.oldData.class}</div>
                          <div>Role: {r.oldData.role}</div>
                        </div>
                      </td>
                      <td>
                        <div className="text-xs leading-relaxed">
                          <div className={isIgnChange ? "text-accent font-bold" : "text-muted"}>
                            IGN: {r.newData.ign} {isIgnChange && "← New"}
                          </div>
                          <div className={isClassChange ? "text-accent font-bold" : "text-muted"}>
                            Class: {r.newData.class} {isClassChange && "← New"}
                          </div>
                          <div className={isRoleChange ? "text-accent font-bold" : "text-muted"}>
                            Role: {r.newData.role} {isRoleChange && "← New"}
                          </div>
                        </div>
                      </td>
                      <td className="text-xs text-muted">
                        {new Date(r.timestamp).toLocaleDateString()} <br />
                        {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button className="btn btn-ghost btn-sm text-red" onClick={() => handleReject(r)}>Reject</button>
                          <button className="btn btn-primary btn-sm" onClick={() => handleApprove(r)}>Approve</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card opacity-80">
        <div className="flex items-center justify-between mb-4">
          <div className="card-title text-sm opacity-70 mb-0">Recently Processed</div>
          {isArchitect && processedRequests.length > 0 && (
            <button className="btn btn-ghost btn-ghost-danger btn-sm" onClick={handleClearAll}>
              <Icon name="trash" size={12} /> Clear All History
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th>Member</th>
                <th>Status</th>
                <th>Requested Info</th>
                <th>Processed Date</th>
                {isArchitect && <th style={{ textAlign: "right" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {processedRequests.map(r => (
                <tr key={r.id}>
                  <td className="py-2">{r.requesterIgn}</td>
                  <td className="py-2">
                    <span className={`badge ${r.status === "approved" ? "badge-active" : "badge-atrisk"}`} style={{ fontSize: 10 }}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 text-muted">
                    {r.newData.ign} | {r.newData.class} | {r.newData.role}
                  </td>
                  <td className="py-2 text-muted">
                    {new Date(r.timestamp).toLocaleDateString()}
                  </td>
                  {isArchitect && (
                    <td className="py-2">
                      <div className="flex justify-end">
                        <button className="btn btn-ghost btn-ghost-danger btn-sm btn-icon" onClick={() => handleDelete(r)} title="Delete record">
                          <Icon name="trash" size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {processedRequests.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-4 text-muted">No history yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default RequestsPage;
