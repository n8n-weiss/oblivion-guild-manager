import React from 'react';
import Skeleton from '../ui/Skeleton';

const DashboardSkeleton = () => (
  <div className="animate-fade-in" style={{ paddingBottom: 40 }}>
    {/* Header Skeleton */}
    <div className="section-header">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Skeleton width="200px" height="32px" borderRadius="8px" />
        </div>
        <Skeleton width="400px" height="16px" />
      </div>
      <div className="guild-xp-container">
        <Skeleton width="150px" height="14px" />
        <Skeleton width="100%" height="6px" />
      </div>
    </div>

    {/* Stats Grid Skeleton */}
    <div className="stats-grid" style={{ marginBottom: 24 }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="stat-card" style={{ height: '120px' }}>
          <Skeleton width="30px" height="30px" borderRadius="50%" />
          <Skeleton width="60%" height="14px" />
          <Skeleton width="40%" height="24px" />
          <Skeleton width="80%" height="12px" />
        </div>
      ))}
    </div>

    {/* Main Widgets Grid */}
    <div className="grid-2 mb-4">
      <div className="card" style={{ height: '300px', padding: '20px' }}>
        <Skeleton width="40%" height="20px" />
        <div className="flex flex-col gap-3 mt-4">
          <Skeleton height="40px" />
          <Skeleton height="40px" />
          <Skeleton height="40px" />
        </div>
      </div>
      <div className="card" style={{ height: '300px', padding: '20px' }}>
        <Skeleton width="30%" height="20px" />
        <Skeleton width="100%" height="120px" />
        <div className="flex flex-col gap-2">
          <Skeleton height="30px" />
          <Skeleton height="30px" />
          <Skeleton height="30px" />
        </div>
      </div>
    </div>

    {/* Bottom Row */}
    <div className="grid-2 mb-4">
       <div className="card" style={{ height: '200px', padding: '20px' }}>
         <Skeleton width="30%" height="20px" />
         <div className="flex flex-col gap-2 mt-4">
           <Skeleton width="90%" height="40px" />
           <Skeleton width="80%" height="40px" />
         </div>
       </div>
       <div className="card" style={{ height: '200px', padding: '20px' }}>
         <Skeleton width="30%" height="20px" />
         <div className="flex flex-col gap-2 mt-4">
           <Skeleton width="100%" height="50px" />
           <Skeleton width="100%" height="50px" />
         </div>
       </div>
    </div>

    {/* Chart Skeleton */}
    <div className="card mb-4" style={{ height: '320px', padding: '20px' }}>
      <Skeleton width="30%" height="20px" />
      <div style={{ height: '250px', marginTop: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
        <Skeleton width="100%" height="100%" />
      </div>
    </div>
  </div>
);

export default DashboardSkeleton;
