import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, RefreshCw, Activity, DollarSign, 
  Target, BarChart3, AlertTriangle, Wifi, WifiOff, Eye, EyeOff,
  Zap, Clock, ArrowUpRight, ArrowDownRight, Package, Layers
} from 'lucide-react';
import { brokerAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Position {
  symbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
  current_price: number;
  pnl: number;
  pnl_percentage: number;
  product: string;
  last_updated: string;
  broker_name: string;
  connection_id: number;
}

interface Holding {
  symbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
  current_price: number;
  pnl: number;
  pnl_percentage: number;
  last_updated: string;
  broker_name: string;
  connection_id: number;
}

interface PnLSummary {
  total_pnl: number;
  total_investment: number;
  total_current_value: number;
  total_positions: number;
  profitable_positions: number;
  loss_positions: number;
  largest_gain: number;
  largest_loss: number;
}

const Positions: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'positions' | 'holdings'>('positions');
  const [positions, setPositions] = useState<Position[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [pnlSummary, setPnlSummary] = useState<PnLSummary | null>(null);
  const [brokerConnections, setBrokerConnections] = useState<any[]>([]);
  const [selectedBroker, setSelectedBroker] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isLiveUpdating, setIsLiveUpdating] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [updateInterval, setUpdateInterval] = useState(5000); // 5 seconds default
  const [showDetails, setShowDetails] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{[key: number]: boolean}>({});
  const [nextUpdateIn, setNextUpdateIn] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const isComponentMounted = useRef(true);

  useEffect(() => {
    fetchInitialData();
    
    return () => {
      isComponentMounted.current = false;
      stopLiveUpdates();
      stopCountdown();
    };
  }, []);

  useEffect(() => {
    if (isLiveUpdating) {
      startLiveUpdates();
    } else {
      stopLiveUpdates();
    }
    
    return () => {
      stopLiveUpdates();
      stopCountdown();
    };
  }, [isLiveUpdating, updateInterval, selectedBroker, activeTab]);

  // Fetch data when tab changes
  useEffect(() => {
    if (brokerConnections.length > 0) {
      if (activeTab === 'positions') {
        fetchPositionsData();
      } else {
        fetchHoldingsData();
      }
    }
  }, [activeTab, selectedBroker]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const connectionsResponse = await brokerAPI.getConnections();
      const activeConnections = connectionsResponse.data.connections.filter(
        (conn: any) => conn.is_active && conn.is_authenticated
      );
      setBrokerConnections(activeConnections);
      
      if (activeConnections.length > 0) {
        await fetchPositionsData();
      }
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
      toast.error('Failed to load broker connections');
    } finally {
      setLoading(false);
    }
  };

  const fetchPositionsData = async () => {
    try {
      const activeConnections = brokerConnections.filter(
        conn => selectedBroker === 'all' || conn.id.toString() === selectedBroker
      );

      if (activeConnections.length === 0) {
        setPositions([]);
        setPnlSummary(null);
        return;
      }

      const allPositions: Position[] = [];
      const connectionStatuses: {[key: number]: boolean} = {};

      // Fetch positions from each active broker connection
      for (const connection of activeConnections) {
        try {
          const response = await brokerAPI.getPositions(connection.id);
          connectionStatuses[connection.id] = true;
          
          if (response.data.positions && response.data.positions.length > 0) {
            const formattedPositions = response.data.positions.map((pos: any) => ({
              symbol: pos.symbol || pos.tradingsymbol,
              exchange: pos.exchange || 'NSE',
              quantity: pos.quantity || pos.net_quantity || 0,
              average_price: pos.average_price || pos.buy_price || pos.price || 0,
              current_price: pos.current_price || pos.last_price || pos.ltp || 0,
              pnl: pos.pnl || pos.unrealised || 0,
              pnl_percentage: pos.pnl_percentage || 0,
              product: pos.product || 'MIS',
              last_updated: new Date().toISOString(),
              broker_name: connection.broker_name,
              connection_id: connection.id
            }));
            
            allPositions.push(...formattedPositions);
          }
        } catch (error) {
          console.error(`Failed to fetch positions from ${connection.broker_name}:`, error);
          connectionStatuses[connection.id] = false;
        }
      }

      // Filter out zero quantity positions
      const activePositions = allPositions.filter(pos => Math.abs(pos.quantity) > 0);
      
      setPositions(activePositions);
      setConnectionStatus(connectionStatuses);
      calculatePnLSummary(activePositions);
      setLastUpdateTime(new Date());
      
    } catch (error) {
      console.error('Failed to fetch positions:', error);
      if (isComponentMounted.current) {
        toast.error('Failed to fetch positions');
      }
    }
  };

  const fetchHoldingsData = async () => {
    try {
      const activeConnections = brokerConnections.filter(
        conn => selectedBroker === 'all' || conn.id.toString() === selectedBroker
      );

      if (activeConnections.length === 0) {
        setHoldings([]);
        setPnlSummary(null);
        return;
      }

      const allHoldings: Holding[] = [];
      const connectionStatuses: {[key: number]: boolean} = {};

      // Fetch holdings from each active broker connection
      for (const connection of activeConnections) {
        try {
          const response = await brokerAPI.getHoldings(connection.id);
          connectionStatuses[connection.id] = true;
          
          if (response.data.holdings && response.data.holdings.length > 0) {
            const formattedHoldings = response.data.holdings.map((holding: any) => ({
              symbol: holding.symbol || holding.tradingsymbol,
              exchange: holding.exchange || 'NSE',
              quantity: holding.quantity || 0,
              average_price: holding.average_price || holding.buy_price || holding.price || 0,
              current_price: holding.current_price || holding.last_price || holding.ltp || 0,
              pnl: holding.pnl || holding.unrealised || 0,
              pnl_percentage: holding.pnl_percentage || 0,
              last_updated: new Date().toISOString(),
              broker_name: connection.broker_name,
              connection_id: connection.id
            }));
            
            allHoldings.push(...formattedHoldings);
          }
        } catch (error) {
          console.error(`Failed to fetch holdings from ${connection.broker_name}:`, error);
          connectionStatuses[connection.id] = false;
        }
      }

      // Filter out zero quantity holdings
      const activeHoldings = allHoldings.filter(holding => Math.abs(holding.quantity) > 0);
      
      setHoldings(activeHoldings);
      setConnectionStatus(connectionStatuses);
      calculatePnLSummary(activeHoldings);
      setLastUpdateTime(new Date());
      
    } catch (error) {
      console.error('Failed to fetch holdings:', error);
      if (isComponentMounted.current) {
        toast.error('Failed to fetch holdings');
      }
    }
  };

  const calculatePnLSummary = (data: (Position | Holding)[]) => {
    if (data.length === 0) {
      setPnlSummary(null);
      return;
    }

    const summary: PnLSummary = {
      total_pnl: 0,
      total_investment: 0,
      total_current_value: 0,
      total_positions: data.length,
      profitable_positions: 0,
      loss_positions: 0,
      largest_gain: 0,
      largest_loss: 0
    };

    data.forEach(item => {
      const investment = Math.abs(item.quantity) * item.average_price;
      const currentValue = Math.abs(item.quantity) * item.current_price;
      const pnl = item.pnl || (currentValue - investment);

      summary.total_pnl += pnl;
      summary.total_investment += investment;
      summary.total_current_value += currentValue;

      if (pnl > 0) {
        summary.profitable_positions++;
        summary.largest_gain = Math.max(summary.largest_gain, pnl);
      } else if (pnl < 0) {
        summary.loss_positions++;
        summary.largest_loss = Math.min(summary.largest_loss, pnl);
      }
    });

    setPnlSummary(summary);
  };

  const startLiveUpdates = () => {
    stopLiveUpdates(); // Clear any existing interval
    stopCountdown(); // Clear any existing countdown
    
    if (brokerConnections.length === 0) return;
    
    // Start countdown
    setNextUpdateIn(updateInterval / 1000);
    startCountdown();
    
    intervalRef.current = setInterval(() => {
      if (isComponentMounted.current) {
        if (activeTab === 'positions') {
          fetchPositionsData();
        } else {
          fetchHoldingsData();
        }
        // Restart countdown
        setNextUpdateIn(updateInterval / 1000);
        startCountdown();
      }
    }, updateInterval);
  };

  const startCountdown = () => {
    stopCountdown();
    countdownRef.current = setInterval(() => {
      setNextUpdateIn(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopLiveUpdates = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setNextUpdateIn(0);
  };

  const toggleLiveUpdates = () => {
    setIsLiveUpdating(!isLiveUpdating);
    if (!isLiveUpdating) {
      toast.success(`Live updates started (${updateInterval/1000}s interval)`);
    } else {
      toast.success('Live updates stopped');
    }
  };

  const handleManualRefresh = async () => {
    if (activeTab === 'positions') {
      await fetchPositionsData();
    } else {
      await fetchHoldingsData();
    }
    toast.success(`${activeTab === 'positions' ? 'Positions' : 'Holdings'} refreshed`);
  };

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-400';
    if (pnl < 0) return 'text-red-400';
    return 'text-olive-200';
  };

  const getPnLBgColor = (pnl: number) => {
    if (pnl > 0) return 'bg-green-800/20 border-green-500/30';
    if (pnl < 0) return 'bg-red-800/20 border-red-500/30';
    return 'bg-olive-800/20 border-olive-500/30';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  const currentData = activeTab === 'positions' ? positions : holdings;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-olive-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center">
            <Activity className="w-8 h-8 mr-3 text-olive-400" />
            Live {activeTab === 'positions' ? 'Positions' : 'Holdings'}
          </h1>
          <p className="text-olive-200/70 mt-1">
            Real-time {activeTab} and P&L directly from your broker accounts
          </p>
          {lastUpdateTime && (
            <div className="flex items-center space-x-4 mt-1">
              <p className="text-olive-300/60 text-sm">
                Last updated: {format(lastUpdateTime, 'HH:mm:ss')}
              </p>
              {isLiveUpdating && nextUpdateIn > 0 && (
                <p className="text-green-400 text-sm flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Next update in {nextUpdateIn}s</span>
                </p>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          {/* Tab Switcher */}
          <div className="flex bg-dark-800/50 rounded-lg p-1 border border-olive-500/20">
            <button
              onClick={() => setActiveTab('positions')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'positions'
                  ? 'bg-olive-600 text-white'
                  : 'text-olive-200 hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4 inline mr-2" />
              Positions
            </button>
            <button
              onClick={() => setActiveTab('holdings')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'holdings'
                  ? 'bg-olive-600 text-white'
                  : 'text-olive-200 hover:text-white'
              }`}
            >
              <Package className="w-4 h-4 inline mr-2" />
              Holdings
            </button>
          </div>

          {/* Broker Filter */}
          <select
            value={selectedBroker}
            onChange={(e) => setSelectedBroker(e.target.value)}
            className="px-4 py-2 bg-dark-800/50 border border-olive-500/20 rounded-lg text-white focus:ring-2 focus:ring-olive-500 focus:border-transparent"
          >
            <option value="all">All Brokers</option>
            {brokerConnections.map(broker => (
              <option key={broker.id} value={broker.id.toString()}>
                {broker.broker_name.charAt(0).toUpperCase() + broker.broker_name.slice(1)}
                {connectionStatus[broker.id] === false && ' (Error)'}
              </option>
            ))}
          </select>

          {/* Update Interval */}
          <select
            value={updateInterval}
            onChange={(e) => setUpdateInterval(Number(e.target.value))}
            className="px-3 py-2 bg-dark-800/50 border border-olive-500/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-olive-500 focus:border-transparent"
          >
            <option value={3000}>3s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={60000}>1m</option>
          </select>

          {/* Manual Refresh */}
          <motion.button
            onClick={handleManualRefresh}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2 bg-olive-600 text-white px-4 py-2 rounded-lg hover:bg-olive-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </motion.button>

          {/* Live Updates Toggle */}
          <motion.button
            onClick={toggleLiveUpdates}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isLiveUpdating
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-dark-700 text-olive-200 hover:bg-dark-600'
            }`}
          >
            {isLiveUpdating ? (
              <>
                <Wifi className="w-4 h-4 animate-pulse" />
                <span>Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                <span>Start Live</span>
              </>
            )}
          </motion.button>

          {/* Details Toggle */}
          <motion.button
            onClick={() => setShowDetails(!showDetails)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2 bg-dark-700 text-olive-200 px-4 py-2 rounded-lg hover:bg-dark-600 transition-colors"
          >
            {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{showDetails ? 'Hide' : 'Show'} Details</span>
          </motion.button>
        </div>
      </motion.div>

      {/* P&L Summary Cards */}
      {pnlSummary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <motion.div
            whileHover={{ scale: 1.02, rotateY: 2 }}
            className={`bg-dark-800/50 backdrop-blur-xl rounded-2xl p-6 shadow-xl border ${getPnLBgColor(pnlSummary.total_pnl)}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-olive-500 to-olive-600 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              {pnlSummary.total_pnl > 0 ? (
                <ArrowUpRight className="w-5 h-5 text-green-400" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-400" />
              )}
            </div>
            <h3 className={`text-2xl font-bold mb-1 ${getPnLColor(pnlSummary.total_pnl)}`}>
              {formatCurrency(pnlSummary.total_pnl)}
            </h3>
            <p className="text-olive-200/70">Total P&L</p>
            {isLiveUpdating && (
              <div className="mt-2 flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-400">Live</span>
              </div>
            )}
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02, rotateY: 2 }}
            className="bg-dark-800/50 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-olive-500/20"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div className="text-olive-400 text-sm font-medium">
                {pnlSummary.total_positions} {activeTab}
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {formatCurrency(pnlSummary.total_current_value)}
            </h3>
            <p className="text-olive-200/70">Current Value</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02, rotateY: 2 }}
            className="bg-dark-800/50 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-olive-500/20"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="text-green-400 text-sm font-medium">
                {pnlSummary.profitable_positions} profitable
              </div>
            </div>
            <h3 className="text-2xl font-bold text-green-400 mb-1">
              {formatCurrency(pnlSummary.largest_gain)}
            </h3>
            <p className="text-olive-200/70">Largest Gain</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02, rotateY: 2 }}
            className="bg-dark-800/50 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-olive-500/20"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <div className="text-red-400 text-sm font-medium">
                {pnlSummary.loss_positions} in loss
              </div>
            </div>
            <h3 className="text-2xl font-bold text-red-400 mb-1">
              {formatCurrency(pnlSummary.largest_loss)}
            </h3>
            <p className="text-olive-200/70">Largest Loss</p>
          </motion.div>
        </motion.div>
      )}

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-dark-800/50 backdrop-blur-xl rounded-2xl shadow-xl border border-olive-500/20 overflow-hidden"
      >
        <div className="p-6 border-b border-olive-500/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center">
              {activeTab === 'positions' ? (
                <BarChart3 className="w-6 h-6 mr-2 text-olive-400" />
              ) : (
                <Package className="w-6 h-6 mr-2 text-olive-400" />
              )}
              Live {activeTab === 'positions' ? 'Positions' : 'Holdings'} ({currentData.length})
            </h2>
            {isLiveUpdating && (
              <div className="flex items-center space-x-2 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm">
                  Updating every {updateInterval/1000}s
                  {nextUpdateIn > 0 && ` (next in ${nextUpdateIn}s)`}
                </span>
              </div>
            )}
          </div>
        </div>

        {currentData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-olive-800/20">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-olive-200">Symbol</th>
                  <th className="text-left py-4 px-6 font-semibold text-olive-200">Qty</th>
                  <th className="text-left py-4 px-6 font-semibold text-olive-200">Avg Price</th>
                  <th className="text-left py-4 px-6 font-semibold text-olive-200">Current Price</th>
                  <th className="text-left py-4 px-6 font-semibold text-olive-200">P&L</th>
                  <th className="text-left py-4 px-6 font-semibold text-olive-200">P&L %</th>
                  {showDetails && (
                    <>
                      <th className="text-left py-4 px-6 font-semibold text-olive-200">Investment</th>
                      <th className="text-left py-4 px-6 font-semibold text-olive-200">Current Value</th>
                      <th className="text-left py-4 px-6 font-semibold text-olive-200">Broker</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {currentData.map((item, index) => {
                    const investment = Math.abs(item.quantity) * item.average_price;
                    const currentValue = Math.abs(item.quantity) * item.current_price;
                    const calculatedPnL = item.pnl || (currentValue - investment);
                    const pnlPercentage = investment > 0 ? (calculatedPnL / investment) * 100 : 0;

                    return (
                      <motion.tr
                        key={`${item.symbol}-${item.connection_id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-olive-500/10 hover:bg-olive-800/10 transition-colors"
                      >
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="font-medium text-white">{item.symbol}</span>
                            <span className="text-xs text-olive-200/70">{item.exchange}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-2">
                            {activeTab === 'positions' && (item as Position).quantity > 0 ? (
                              <TrendingUp className="w-4 h-4 text-green-400" />
                            ) : activeTab === 'positions' && (item as Position).quantity < 0 ? (
                              <TrendingDown className="w-4 h-4 text-red-400" />
                            ) : (
                              <Layers className="w-4 h-4 text-blue-400" />
                            )}
                            <span className={`font-medium ${
                              activeTab === 'positions' 
                                ? (item as Position).quantity > 0 ? 'text-green-400' : 'text-red-400'
                                : 'text-blue-400'
                            }`}>
                              {Math.abs(item.quantity)}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-olive-200">
                          {formatCurrency(item.average_price)}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-2">
                            <span className="text-white font-medium">
                              {formatCurrency(item.current_price)}
                            </span>
                            {isLiveUpdating && (
                              <Zap className="w-3 h-3 text-yellow-400 animate-pulse" />
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`font-bold ${getPnLColor(calculatedPnL)}`}>
                            {calculatedPnL > 0 ? '+' : ''}{formatCurrency(calculatedPnL)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`font-medium ${getPnLColor(calculatedPnL)}`}>
                            {formatPercentage(pnlPercentage)}
                          </span>
                        </td>
                        {showDetails && (
                          <>
                            <td className="py-4 px-6 text-olive-200">
                              {formatCurrency(investment)}
                            </td>
                            <td className="py-4 px-6 text-olive-200">
                              {formatCurrency(currentValue)}
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center space-x-2">
                                <span className="text-olive-200 capitalize">
                                  {item.broker_name}
                                </span>
                                {connectionStatus[item.connection_id] === false && (
                                  <AlertTriangle className="w-4 h-4 text-red-400" />
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            {activeTab === 'positions' ? (
              <Activity className="w-16 h-16 text-olive-400/50 mx-auto mb-4" />
            ) : (
              <Package className="w-16 h-16 text-olive-400/50 mx-auto mb-4" />
            )}
            <h3 className="text-lg font-medium text-white mb-2">
              No Active {activeTab === 'positions' ? 'Positions' : 'Holdings'}
            </h3>
            <p className="text-olive-200/70">
              {brokerConnections.length === 0 
                ? 'Connect a broker account to see your data'
                : `You currently have no ${activeTab}`
              }
            </p>
          </div>
        )}
      </motion.div>

      {/* Connection Status */}
      {brokerConnections.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-dark-800/30 backdrop-blur-xl rounded-xl p-4 border border-olive-500/10"
        >
          <h3 className="text-sm font-medium text-olive-200 mb-3">Broker Connection Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {brokerConnections.map(broker => (
              <div key={broker.id} className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  connectionStatus[broker.id] === false 
                    ? 'bg-red-400' 
                    : 'bg-green-400 animate-pulse'
                }`}></div>
                <span className="text-olive-200 capitalize">{broker.broker_name}</span>
                {connectionStatus[broker.id] === false && (
                  <span className="text-xs text-red-400">Connection Error</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Positions;