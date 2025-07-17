import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, RefreshCw, Search, Download, Upload, 
  CheckCircle, AlertCircle, Clock, XCircle, 
  TrendingUp, BarChart3, Activity
} from 'lucide-react';
import { symbolsAPI } from '../../services/api';
import SymbolSearch from './SymbolSearch';
import SegmentSymbolSearch from './SegmentSymbolSearch';
import toast from 'react-hot-toast';

interface SyncStatus {
  id: number;
  broker_name: string;
  last_sync_at: string;
  sync_status: string;
  total_symbols: number;
  error_message?: string;
  updated_at: string;
}

const SymbolsManagement: React.FC = () => {
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<any>(null);
  const [detailedSymbolInfo, setDetailedSymbolInfo] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [symbolFiles, setSymbolFiles] = useState<any[]>([]);

  useEffect(() => {
    fetchSyncStatus();
    fetchSymbolFiles();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      setLoading(true);
      const response = await symbolsAPI.getSyncStatus();
      setSyncStatuses(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
      toast.error('Failed to fetch sync status');
      setSyncStatuses([]); // Ensure it's always an array
    } finally {
      setLoading(false);
    }
  };

  const syncAllBrokers = async () => {
    try {
      setSyncing(['all']);
      await symbolsAPI.syncAllSymbols();
      toast.success('Symbol sync started for all brokers');
      
      // Refresh status after a delay
      setTimeout(() => {
        fetchSyncStatus();
        setSyncing([]);
      }, 2000);
    } catch (error) {
      toast.error('Failed to start symbol sync');
      setSyncing([]);
    }
  };

  const syncBroker = async (brokerName: string) => {
    try {
      setSyncing([brokerName]);
      await symbolsAPI.syncBrokerSymbols(brokerName);
      toast.success(`Symbol sync started for ${brokerName}`);
      
      // Refresh status after a delay
      setTimeout(() => {
        fetchSyncStatus();
        setSyncing(prev => prev.filter(b => b !== brokerName));
      }, 2000);
    } catch (error) {
      toast.error(`Failed to start sync for ${brokerName}`);
      setSyncing(prev => prev.filter(b => b !== brokerName));
    }
  };

  const fetchSymbolFiles = async () => {
    try {
      const response = await symbolsAPI.getSymbolFiles();
      setSymbolFiles(response.data || []);
    } catch (error) {
      console.error('Failed to fetch symbol files:', error);
      setSymbolFiles([]);
    }
  };

  const fetchDetailedSymbolInfo = async (symbol: string, exchange: string) => {
    try {
      setLoadingDetails(true);
      const response = await symbolsAPI.getSymbolDetails(symbol, exchange);
      setDetailedSymbolInfo(response.data);
      toast.success('Detailed symbol information loaded');
    } catch (error) {
      console.error('Failed to fetch detailed symbol info:', error);
      toast.error('Failed to load detailed symbol information');
      setDetailedSymbolInfo(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const downloadSymbolFile = async (broker: string, type: string, date: string = 'latest') => {
    try {
      const response = await symbolsAPI.downloadSymbolFile(broker, type, date);
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${broker}_symbols_${date}.${type}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Downloaded ${broker} symbols file`);
    } catch (error) {
      console.error('Failed to download symbol file:', error);
      toast.error('Failed to download symbol file');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const totalSymbols = syncStatuses.reduce((sum, status) => sum + (status.total_symbols || 0), 0);
  const completedSyncs = syncStatuses.filter(s => s.sync_status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-bronze-800 flex items-center">
            <Database className="w-8 h-8 mr-3 text-amber-600" />
            Symbols Management
          </h1>
          <p className="text-bronze-600 mt-1">
            Manage and synchronize trading symbols across all brokers
          </p>
        </div>
        
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <motion.button
            onClick={fetchSyncStatus}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2 bg-bronze-600 text-white px-4 py-2 rounded-lg hover:bg-bronze-700 transition-colors shadow-3d"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </motion.button>
          
          <motion.button
            onClick={syncAllBrokers}
            disabled={syncing.includes('all')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-3d"
          >
            {syncing.includes('all') ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Sync All</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-3d border border-beige-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-bronze-600 text-sm">Total Symbols</p>
              <p className="text-2xl font-bold text-bronze-800">{totalSymbols.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-amber-600" />
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-3d border border-beige-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-bronze-600 text-sm">Synced Brokers</p>
              <p className="text-2xl font-bold text-bronze-800">{completedSyncs}/{syncStatuses.length}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-3d border border-beige-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-bronze-600 text-sm">Last Updated</p>
              <p className="text-sm font-medium text-bronze-800">
                {syncStatuses.length > 0 
                  ? formatDate(Math.max(...syncStatuses.map(s => new Date(s.updated_at).getTime())).toString())
                  : 'Never'
                }
              </p>
            </div>
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </motion.div>

      {/* Segment-Specific Symbol Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-3d border border-beige-200"
      >
        <h2 className="text-xl font-bold text-bronze-800 mb-6 flex items-center">
          <Search className="w-5 h-5 mr-2 text-amber-600" />
          Segment-Specific Symbol Search
        </h2>
        
        <div className="space-y-6">
          <SegmentSymbolSearch
            onSymbolSelect={(symbol) => {
              setSelectedSymbol(symbol);
              toast.success(`Selected ${symbol.symbol} from ${symbol.segment}`);
            }}
            className="w-full"
          />

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or use general search</span>
            </div>
          </div>

          {/* Fallback General Search */}
          <div className="opacity-75">
            <label className="block text-sm font-medium text-bronze-700 mb-2">
              General Symbol Search (All Segments)
            </label>
            <SymbolSearch
              onSymbolSelect={(symbol) => {
                setSelectedSymbol(symbol);
                toast.success(`Selected ${symbol.symbol} from ${symbol.exchange}`);
              }}
              placeholder="Type 3+ letters to search across all segments..."
              className="w-full"
            />
          </div>
          
          {selectedSymbol && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg"
            >
              <h3 className="font-bold text-amber-800 mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Symbol Details: {selectedSymbol.symbol}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Basic Information */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-bronze-700 border-b border-amber-200 pb-1">Basic Info</h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>Symbol:</strong> {selectedSymbol.symbol}</p>
                    <p><strong>Name:</strong> {selectedSymbol.name || 'N/A'}</p>
                    <p><strong>Exchange:</strong> {selectedSymbol.exchange}</p>
                    <p><strong>Segment:</strong> {selectedSymbol.segment}</p>
                    <p><strong>Type:</strong> {selectedSymbol.instrument_type}</p>
                  </div>
                </div>
                
                {/* Trading Information */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-bronze-700 border-b border-amber-200 pb-1">Trading Info</h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>Lot Size:</strong> {selectedSymbol.lot_size || 1}</p>
                    <p><strong>Tick Size:</strong> {selectedSymbol.tick_size || 0.05}</p>
                    {selectedSymbol.expiry_date && (
                      <p><strong>Expiry:</strong> {new Date(selectedSymbol.expiry_date).toLocaleDateString()}</p>
                    )}
                    {selectedSymbol.strike_price && (
                      <p><strong>Strike:</strong> ₹{selectedSymbol.strike_price}</p>
                    )}
                    {selectedSymbol.option_type && (
                      <p><strong>Option Type:</strong> {selectedSymbol.option_type}</p>
                    )}
                  </div>
                </div>
                
                {/* Broker Support */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-bronze-700 border-b border-amber-200 pb-1">Broker Support</h4>
                  <div className="space-y-2">
                    {selectedSymbol.supported_brokers && selectedSymbol.supported_brokers.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedSymbol.supported_brokers.map((broker, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full border border-green-200"
                          >
                            {broker}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No broker mappings available</p>
                    )}
                    
                    {selectedSymbol.broker_tokens && selectedSymbol.broker_tokens.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-600 mb-1">Broker Tokens:</p>
                        <div className="space-y-1">
                          {selectedSymbol.supported_brokers.map((broker, index) => (
                            selectedSymbol.broker_tokens[index] && (
                              <div key={index} className="text-xs">
                                <span className="font-medium">{broker}:</span> {selectedSymbol.broker_tokens[index]}
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Additional Details Button */}
              <div className="mt-4 pt-4 border-t border-amber-200">
                <button
                  onClick={() => fetchDetailedSymbolInfo(selectedSymbol.symbol, selectedSymbol.exchange)}
                  disabled={loadingDetails}
                  className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingDetails ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  <span>{loadingDetails ? 'Loading...' : 'View Complete Details'}</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* Detailed Symbol Information */}
          {detailedSymbolInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg"
            >
              <h3 className="font-bold text-blue-800 mb-4 flex items-center">
                <Database className="w-5 h-5 mr-2" />
                Complete Symbol Details: {detailedSymbolInfo.symbol}
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Instrument Details */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-blue-700 border-b border-blue-200 pb-1">Instrument Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium">Symbol:</span>
                      <span>{detailedSymbolInfo.symbol}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium">Name:</span>
                      <span>{detailedSymbolInfo.name || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium">Exchange:</span>
                      <span>{detailedSymbolInfo.exchange}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium">Segment:</span>
                      <span>{detailedSymbolInfo.segment}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium">Type:</span>
                      <span>{detailedSymbolInfo.instrument_type}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium">Lot Size:</span>
                      <span>{detailedSymbolInfo.lot_size || 1}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium">Tick Size:</span>
                      <span>{detailedSymbolInfo.tick_size || 0.05}</span>
                    </div>
                    {detailedSymbolInfo.isin && (
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium">ISIN:</span>
                        <span className="font-mono text-xs">{detailedSymbolInfo.isin}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Broker Mappings */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-blue-700 border-b border-blue-200 pb-1">Broker Mappings</h4>
                  {detailedSymbolInfo.broker_mappings && detailedSymbolInfo.broker_mappings.length > 0 ? (
                    <div className="space-y-3">
                      {detailedSymbolInfo.broker_mappings.map((mapping: any, index: number) => (
                        <div key={index} className="p-3 bg-white rounded-lg border border-blue-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-blue-800 capitalize">{mapping.broker_name}</span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              mapping.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {mapping.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <div><strong>Symbol:</strong> {mapping.broker_symbol}</div>
                            <div><strong>Token:</strong> {mapping.broker_token || 'N/A'}</div>
                            <div><strong>Exchange:</strong> {mapping.broker_exchange}</div>
                            <div><strong>Updated:</strong> {new Date(mapping.updated_at).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No broker mappings available</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Broker Sync Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-3d border border-beige-200"
      >
        <h2 className="text-xl font-bold text-bronze-800 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-amber-600" />
          Broker Sync Status
        </h2>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
            <span className="ml-2 text-bronze-600">Loading sync status...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {syncStatuses.map((status) => (
              <motion.div
                key={status.broker_name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-4 bg-cream-50 rounded-lg border border-beige-200"
              >
                <div className="flex items-center space-x-4">
                  {getStatusIcon(status.sync_status)}
                  <div>
                    <h3 className="font-bold text-bronze-800 capitalize">{status.broker_name}</h3>
                    <p className="text-sm text-bronze-600">
                      {status.total_symbols.toLocaleString()} symbols • Last sync: {formatDate(status.last_sync_at)}
                    </p>
                    {status.error_message && (
                      <p className="text-sm text-red-600 mt-1">Error: {status.error_message}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 text-xs rounded-full border ${getStatusColor(status.sync_status)}`}>
                    {status.sync_status.replace('_', ' ').toUpperCase()}
                  </span>
                  
                  <motion.button
                    onClick={() => syncBroker(status.broker_name)}
                    disabled={syncing.includes(status.broker_name)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center space-x-1 bg-amber-600 text-white px-3 py-1 rounded text-sm hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncing.includes(status.broker_name) ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span>Sync</span>
                  </motion.button>
                </div>
              </motion.div>
            ))}
            
            {syncStatuses.length === 0 && (
              <div className="text-center py-8 text-bronze-600">
                <Database className="w-12 h-12 mx-auto mb-4 text-bronze-400" />
                <p>No sync status available. Click "Sync All" to start synchronizing symbols.</p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Symbol Files Management */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-3d border border-beige-200"
      >
        <h2 className="text-xl font-bold text-bronze-800 mb-4 flex items-center">
          <Download className="w-5 h-5 mr-2 text-amber-600" />
          Symbol Files
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-bronze-600">
              Download symbol data files for offline use or integration
            </p>
            <button
              onClick={fetchSymbolFiles}
              className="flex items-center space-x-2 px-3 py-2 bg-bronze-600 text-white rounded-lg hover:bg-bronze-700 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
          
          {symbolFiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {symbolFiles.map((file, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-cream-50 rounded-lg border border-beige-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-bronze-800 capitalize">{file.broker}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      file.type === 'json' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {file.type.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-sm text-bronze-600 mb-3">
                    <p><strong>Date:</strong> {file.date === 'latest' ? 'Latest' : file.date}</p>
                    <p><strong>Size:</strong> {(file.size / 1024).toFixed(1)} KB</p>
                    <p><strong>Modified:</strong> {new Date(file.modified).toLocaleDateString()}</p>
                  </div>
                  
                  <button
                    onClick={() => downloadSymbolFile(file.broker, file.type, file.date)}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-bronze-600">
              <Download className="w-12 h-12 mx-auto mb-4 text-bronze-400" />
              <p>No symbol files available. Sync symbols first to generate files.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SymbolsManagement;