import { TrendingUp, TrendingDown } from 'lucide-react';

const MetricCard = ({ title, value, change, isPositive, icon: Icon }) => {
  const changeClass = isPositive === false ? 'text-red-light' : isPositive === true ? 'text-green' : 'text-secondary';

  return (
    <div className="glass-panel metric-card p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h3 className="metric-title">{title}</h3>
        {Icon && <Icon size={20} className="text-gold" />}
      </div>
      <div className="metric-value">{value}</div>
      <div className={`metric-change ${changeClass}`}>
        {isPositive === true && <TrendingUp size={16} />}
        {isPositive === false && <TrendingDown size={16} />}
        <span>{change}</span>
      </div>
    </div>
  );
};

export default MetricCard;
