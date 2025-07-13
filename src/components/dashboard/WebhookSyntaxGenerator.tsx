import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Code, Copy, CheckCircle, Download, RefreshCw, Settings, 
  Zap, AlertCircle, BookOpen, ExternalLink, Play, FileText
} from 'lucide-react';
import { brokerAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface BrokerConfig {
  id: string;
  name: string;
  webhookFormat: string;
  orderFields: {
    required: string[];
    optional: string[];
  };
}

interface WebhookSyntax {
  broker: string;
  format: string;
  required_fields: string[];
  optional_fields: string[];
  example: any;
}

const WebhookSyntaxGenerator: React.FC = () => {
  const [selectedBroker, setSelectedBroker] = useState<string>('zerodha');
  const [brokerConfigs, setBrokerConfigs] = useState<BrokerConfig[]>([]);
  const [webhookSyntax, setWebhookSyntax] = useState<WebhookSyntax | null>(null);
  const [customFields, setCustomFields] = useState<{[key: string]: any}>({
    symbol: 'RELIANCE',
    action: 'BUY',
    quantity: 1,
    order_type: 'MARKET',
    product: 'MIS',
    exchange: 'NSE',
    price: 0,
    trigger_price: 0
  });
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBrokerConfigs();
  }, []);

  useEffect(() => {
    if (selectedBroker) {
      generateSyntax();
    }
  }, [selectedBroker, customFields]);

  const fetchBrokerConfigs = async () => {
    try {
      // This would be an API call to get broker configurations
      const mockConfigs: BrokerConfig[] = [
        {
          id: 'zerodha',
          name: 'Zerodha',
          webhookFormat: 'zerodha',
          orderFields: {
            required: ['symbol', 'action', 'quantity', 'order_type', 'product'],
            optional: ['exchange', 'validity', 'price', 'trigger_price', 'tag']
          }
        },
        {
          id: 'upstox',
          name: 'Upstox',
          webhookFormat: 'upstox',
          orderFields: {
            required: ['symbol', 'action', 'quantity', 'order_type', 'product'],
            optional: ['exchange', 'validity', 'price', 'trigger_price', 'disclosed_quantity', 'is_amo', 'tag']
          }
        },
        {
          id: 'angel',
          name: 'Angel Broking',
          webhookFormat: 'angel',
          orderFields: {
            required: ['symbol', 'symboltoken', 'action', 'quantity', 'order_type', 'product'],
            optional: ['exchange', 'validity', 'price', 'squareoff', 'stoploss']
          }
        },
        {
          id: 'shoonya',
          name: 'Shoonya',
          webhookFormat: 'shoonya',
          orderFields: {
            required: ['symbol', 'action', 'quantity', 'order_type', 'product'],
            optional: ['exchange', 'validity', 'price', 'trigger_price']
          }
        },
        {
          id: '5paisa',
          name: '5Paisa',
          webhookFormat: '5paisa',
          orderFields: {
            required: ['symbol', 'action', 'quantity', 'order_type'],
            optional: ['exchange', 'price', 'disclosed_quantity', 'is_intraday']
          }
        }
      ];
      
      setBrokerConfigs(mockConfigs);
    } catch (error) {
      console.error('Failed to fetch broker configs:', error);
      toast.error('Failed to load broker configurations');
    } finally {
      setLoading(false);
    }
  };

  const generateSyntax = () => {
    const brokerExamples = {
      zerodha: {
        symbol: customFields.symbol || "RELIANCE",
        action: customFields.action || "BUY",
        quantity: parseInt(customFields.quantity) || 1,
        order_type: customFields.order_type || "MARKET",
        product: customFields.product || "MIS",
        exchange: customFields.exchange || "NSE",
        validity: customFields.validity || "DAY",
        price: parseFloat(customFields.price) || 0,
        trigger_price: parseFloat(customFields.trigger_price) || 0,
        tag: "TradingView"
      },
      upstox: {
        symbol: customFields.symbol || "RELIANCE",
        action: customFields.action || "BUY",
        quantity: parseInt(customFields.quantity) || 1,
        order_type: customFields.order_type || "MARKET",
        product: customFields.product === "MIS" ? "I" : "D",
        exchange: customFields.exchange === "NSE" ? "NSE_EQ" : customFields.exchange || "NSE_EQ",
        validity: customFields.validity || "DAY",
        price: parseFloat(customFields.price) || 0,
        trigger_price: parseFloat(customFields.trigger_price) || 0,
        disclosed_quantity: parseInt(customFields.disclosed_quantity) || 0,
        is_amo: customFields.is_amo || false,
        tag: "TradingView"
      },
      angel: {
        symbol: customFields.symbol || "RELIANCE-EQ",
        symboltoken: customFields.symboltoken || "2885",
        action: customFields.action || "BUY",
        quantity: parseInt(customFields.quantity) || 1,
        order_type: customFields.order_type || "MARKET",
        product: customFields.product === "MIS" ? "INTRADAY" : "DELIVERY",
        exchange: customFields.exchange || "NSE",
        validity: customFields.validity || "DAY",
        price: customFields.price?.toString() || "0",
        squareoff: customFields.squareoff?.toString() || "0",
        stoploss: customFields.stoploss?.toString() || "0"
      },
      shoonya: {
        symbol: customFields.symbol || "RELIANCE",
        action: customFields.action || "BUY",
        quantity: parseInt(customFields.quantity) || 1,
        order_type: customFields.order_type === "MARKET" ? "MKT" : "LMT",
        product: customFields.product === "MIS" ? "I" : "C",
        exchange: customFields.exchange || "NSE",
        validity: customFields.validity || "DAY",
        price: customFields.price?.toString() || "0",
        trigger_price: customFields.trigger_price?.toString() || "0"
      },
      '5paisa': {
        symbol: customFields.symbol || "RELIANCE",
        action: customFields.action || "BUY",
        quantity: parseInt(customFields.quantity) || 1,
        order_type: customFields.order_type || "MARKET",
        exchange: customFields.exchange === "NSE" ? "N" : "B",
        price: parseFloat(customFields.price) || 0,
        disclosed_quantity: parseInt(customFields.disclosed_quantity) || 0,
        is_intraday: customFields.is_intraday !== false
      }
    };

    const config = brokerConfigs.find(b => b.id === selectedBroker);
    if (config) {
      setWebhookSyntax({
        broker: config.name,
        format: config.webhookFormat,
        required_fields: config.orderFields.required,
        optional_fields: config.orderFields.optional,
        example: brokerExamples[selectedBroker as keyof typeof brokerExamples]
      });
    }
  };

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast.success(`${section} copied to clipboard!`);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const downloadSyntax = () => {
    if (!webhookSyntax) return;
    
    const content = `# ${webhookSyntax.broker} Webhook Syntax

## Required Fields
${webhookSyntax.required_fields.map(field => `- ${field}`).join('\n')}

## Optional Fields
${webhookSyntax.optional_fields.map(field => `- ${field}`).join('\n')}

## Example Payload
\`\`\`json
${JSON.stringify(webhookSyntax.example, null, 2)}
\`\`\`

## TradingView Alert Syntax
\`\`\`
${JSON.stringify(webhookSyntax.example, null, 2)}
\`\`\`
`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedBroker}-webhook-syntax.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Syntax file downloaded!');
  };

  const brokerDocs = {
    zerodha: 'https://kite.trade/docs/connect/v3/',
    upstox: 'https://upstox.com/developer/api-documentation',
    angel: 'https://smartapi.angelbroking.com/docs',
    shoonya: 'https://github.com/Shoonya-Dev/ShoonyaApi-js',
    '5paisa': 'https://www.5paisa.com/developerapi'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

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
            <Code className="w-8 h-8 mr-3 text-amber-600" />
            Webhook Syntax Generator
          </h1>
          <p className="text-bronze-600 mt-1">
            Generate webhook payloads for TradingView alerts based on your broker requirements
          </p>
        </div>
        
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <motion.button
            onClick={downloadSyntax}
            disabled={!webhookSyntax}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2 bg-bronze-600 text-white px-4 py-2 rounded-lg hover:bg-bronze-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </motion.button>
          
          <motion.button
            onClick={generateSyntax}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Regenerate</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Broker Selection and Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-3d border border-beige-200"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Broker Selection */}
          <div>
            <h2 className="text-xl font-bold text-bronze-800 mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-amber-600" />
              Broker Configuration
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-bronze-700 mb-2">
                  Select Broker
                </label>
                <select
                  value={selectedBroker}
                  onChange={(e) => setSelectedBroker(e.target.value)}
                  className="w-full px-4 py-3 bg-cream-50 border border-beige-200 rounded-lg text-bronze-800 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  {brokerConfigs.map(broker => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBroker && brokerDocs[selectedBroker as keyof typeof brokerDocs] && (
                <motion.a
                  href={brokerDocs[selectedBroker as keyof typeof brokerDocs]}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.02 }}
                  className="inline-flex items-center space-x-2 text-amber-600 hover:text-amber-500 font-medium"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>View {brokerConfigs.find(b => b.id === selectedBroker)?.name} Documentation</span>
                  <ExternalLink className="w-4 h-4" />
                </motion.a>
              )}
            </div>
          </div>

          {/* Custom Fields */}
          <div>
            <h2 className="text-xl font-bold text-bronze-800 mb-4 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-amber-600" />
              Customize Order Parameters
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-bronze-700 mb-1">Symbol</label>
                <input
                  type="text"
                  value={customFields.symbol}
                  onChange={(e) => setCustomFields({...customFields, symbol: e.target.value})}
                  className="w-full px-3 py-2 bg-cream-50 border border-beige-200 rounded-lg text-bronze-800 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="RELIANCE"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-bronze-700 mb-1">Action</label>
                <select
                  value={customFields.action}
                  onChange={(e) => setCustomFields({...customFields, action: e.target.value})}
                  className="w-full px-3 py-2 bg-cream-50 border border-beige-200 rounded-lg text-bronze-800 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-bronze-700 mb-1">Quantity</label>
                <input
                  type="number"
                  value={customFields.quantity}
                  onChange={(e) => setCustomFields({...customFields, quantity: e.target.value})}
                  className="w-full px-3 py-2 bg-cream-50 border border-beige-200 rounded-lg text-bronze-800 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-bronze-700 mb-1">Order Type</label>
                <select
                  value={customFields.order_type}
                  onChange={(e) => setCustomFields({...customFields, order_type: e.target.value})}
                  className="w-full px-3 py-2 bg-cream-50 border border-beige-200 rounded-lg text-bronze-800 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="MARKET">MARKET</option>
                  <option value="LIMIT">LIMIT</option>
                  <option value="SL">STOP LOSS</option>
                  <option value="SL-M">STOP LOSS MARKET</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-bronze-700 mb-1">Product</label>
                <select
                  value={customFields.product}
                  onChange={(e) => setCustomFields({...customFields, product: e.target.value})}
                  className="w-full px-3 py-2 bg-cream-50 border border-beige-200 rounded-lg text-bronze-800 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="MIS">MIS (Intraday)</option>
                  <option value="CNC">CNC (Delivery)</option>
                  <option value="NRML">NRML (Normal)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-bronze-700 mb-1">Exchange</label>
                <select
                  value={customFields.exchange}
                  onChange={(e) => setCustomFields({...customFields, exchange: e.target.value})}
                  className="w-full px-3 py-2 bg-cream-50 border border-beige-200 rounded-lg text-bronze-800 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                  <option value="NFO">NFO</option>
                  <option value="BFO">BFO</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Generated Syntax */}
      <AnimatePresence>
        {webhookSyntax && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Field Requirements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-3d border border-beige-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-bronze-800 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
                    Required Fields
                  </h3>
                  <motion.button
                    onClick={() => copyToClipboard(webhookSyntax.required_fields.join(', '), 'Required Fields')}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="text-amber-600 hover:text-amber-500"
                  >
                    {copiedSection === 'Required Fields' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </motion.button>
                </div>
                <div className="space-y-2">
                  {webhookSyntax.required_fields.map((field, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <code className="text-sm text-bronze-700 bg-red-50 px-2 py-1 rounded">{field}</code>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.01 }}
                className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-3d border border-beige-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-bronze-800 flex items-center">
                    <Settings className="w-5 h-5 mr-2 text-blue-600" />
                    Optional Fields
                  </h3>
                  <motion.button
                    onClick={() => copyToClipboard(webhookSyntax.optional_fields.join(', '), 'Optional Fields')}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="text-amber-600 hover:text-amber-500"
                  >
                    {copiedSection === 'Optional Fields' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </motion.button>
                </div>
                <div className="space-y-2">
                  {webhookSyntax.optional_fields.map((field, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <code className="text-sm text-bronze-700 bg-blue-50 px-2 py-1 rounded">{field}</code>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Example Payload */}
            <motion.div
              whileHover={{ scale: 1.005 }}
              className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-3d border border-beige-200"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-bronze-800 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-amber-600" />
                  Example Webhook Payload for {webhookSyntax.broker}
                </h3>
                <div className="flex items-center space-x-2">
                  <motion.button
                    onClick={() => copyToClipboard(JSON.stringify(webhookSyntax.example, null, 2), 'Example Payload')}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="text-amber-600 hover:text-amber-500"
                  >
                    {copiedSection === 'Example Payload' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </motion.button>
                </div>
              </div>
              
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-green-400 text-sm">
                  <code>{JSON.stringify(webhookSyntax.example, null, 2)}</code>
                </pre>
              </div>
            </motion.div>

            {/* TradingView Instructions */}
            <motion.div
              whileHover={{ scale: 1.005 }}
              className="bg-gradient-to-r from-amber-50 to-bronze-50 rounded-2xl p-6 border border-amber-200 shadow-3d"
            >
              <h3 className="text-lg font-bold text-bronze-800 mb-4 flex items-center">
                <Play className="w-5 h-5 mr-2 text-amber-600" />
                How to Use in TradingView
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <p className="text-bronze-800 font-medium">Create Alert in TradingView</p>
                    <p className="text-bronze-600 text-sm">Go to your chart and click on the Alert button</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <p className="text-bronze-800 font-medium">Configure Webhook</p>
                    <p className="text-bronze-600 text-sm">In the Notifications tab, check "Webhook URL" and paste your webhook URL</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <p className="text-bronze-800 font-medium">Add Payload</p>
                    <p className="text-bronze-600 text-sm">Copy the example payload above and paste it in the "Message" field</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                  <div>
                    <p className="text-bronze-800 font-medium">Test & Activate</p>
                    <p className="text-bronze-600 text-sm">Test your alert and activate it to start automated trading</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WebhookSyntaxGenerator;
