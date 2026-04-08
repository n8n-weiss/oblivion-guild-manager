import { motion } from 'framer-motion';
const MotionDiv = motion.div;

const Skeleton = ({ width, height, borderRadius = '12px', className = '' }) => {
  return (
    <div 
      className={`skeleton-loader ${className}`}
      style={{
        width: width || '100%',
        height: height || '20px',
        borderRadius,
        background: 'rgba(255, 255, 255, 0.03)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}
    >
      <MotionDiv
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{ 
          repeat: Infinity, 
          duration: 1.5, 
          ease: "linear" 
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(90deg, transparent, rgba(99, 130, 230, 0.08), transparent)',
          width: '50%'
        }}
      />
    </div>
  );
};

export const CardSkeleton = () => (
  <div className="card" style={{ padding: '20px', gap: '12px', display: 'flex', flexDirection: 'column' }}>
    <Skeleton width="40%" height="24px" />
    <Skeleton height="100px" />
    <div style={{ display: 'flex', gap: '8px' }}>
      <Skeleton width="30%" height="16px" />
      <Skeleton width="30%" height="16px" />
    </div>
  </div>
);

export default Skeleton;
