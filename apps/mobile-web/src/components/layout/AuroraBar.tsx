import React from 'react';

export const AuroraBar: React.FC<{ sweep?: boolean }> = ({ sweep = true }) => (
  <div className={`aurora-bar ${sweep ? 'sweep' : ''}`} aria-hidden="true">
    <div className="segment teal" />
    <div className="segment cyan" />
    <div className="segment blue" />
  </div>
);
