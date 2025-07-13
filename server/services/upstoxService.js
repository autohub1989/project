import axios from 'axios';
import { db } from '../database/init.js';
import { encryptData, decryptData } from '../utils/encryption.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('UpstoxService');

class UpstoxService {
  constructor() {
    this.upstoxInstances = new Map(); // Store Upstox instances per connection
    this.baseURL = 'https://api.upstox.com/v2';
  }

  // Generate access token from authorization code
  async generateAccessToken(apiKey, apiSecret, authorizationCode, redirectUri) {
    try {
      logger.info('Generating Upstox access token', {
        apiKeyLength: apiKey ? apiKey.length : 0,
        apiSecretProvided: !!apiSecret,
        authCodeProvided: !!authorizationCode,
        redirectUri: redirectUri
      });
      
      const tokenUrl = `${this.baseURL}/login/authorization/token`;
      
      // Log the exact values being sent (masked for security)
      const maskedApiKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'undefined';
      const maskedApiSecret = apiSecret ? '********' : 'undefined';
      const maskedAuthCode = authorizationCode ? `${authorizationCode.substring(0, 4)}...` : 'undefined';
      
      logger.info('Upstox authentication parameters', {
        maskedApiKey,
        maskedAuthCode,
        redirectUri,
        tokenUrl
      });
      
      // Prepare form data for token request
      const formData = new URLSearchParams({
        code: authorizationCode,
        client_id: apiKey,
        client_secret: apiSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      });

      // Log the exact request being sent
      logger.info('Upstox token request details', {
        url: tokenUrl,
        client_id: maskedApiKey,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        hasCode: !!authorizationCode,
        hasSecret: !!apiSecret,
        formDataString: formData.toString().replace(/(client_secret|code)=[^&]+/g, '$1=REDACTED')
      });

      // Also log to console for immediate visibility
      console.log('🔐 Token request data:', {
        url: tokenUrl,
        client_id: maskedApiKey,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        hasCode: !!authorizationCode,
        hasSecret: !!apiSecret
      });

      const response = await axios.post(tokenUrl, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'AutoTraderHub/1.0'
        },
        timeout: 30000 // 30 second timeout
      });

      logger.info('Upstox token response received', {
        status: response.status,
        statusText: response.statusText,
        hasAccessToken: !!response.data?.access_token,
        hasRefreshToken: !!response.data?.refresh_token,
        expiresIn: response.data?.expires_in
      });

      console.log('✅ Upstox token response status:', response.status);
      console.log('✅ Upstox token response data:', response.data);

      logger.info('Upstox access token generated successfully');
      return response.data;
    } catch (error) {
      // Enhanced error logging
      const errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        stack: error.stack
      };
      
      logger.error('Failed to generate Upstox access token', errorDetails);
      
      // Log the full error response for debugging
      if (error.response?.data) {
        logger.error('Upstox error response data', { 
          responseData: JSON.stringify(error.response.data),
          headers: error.response.headers
        });
      }
      
      console.error('❌ Upstox token generation failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.response?.data?.error_description ||
                          error.message;
      
      throw new Error(`Failed to generate access token: ${errorMessage}`);
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken(brokerConnectionId) {
    try {
      logger.info(`Refreshing Upstox access token for connection ${brokerConnectionId}`);
      
      const connection = await db.getAsync(
        'SELECT * FROM broker_connections WHERE id = ? AND is_active = 1',
        [brokerConnectionId]
      );

      if (!connection || !connection.refresh_token) {
        throw new Error('Connection not found or refresh token not available');
      }

      const apiKey = decryptData(connection.api_key);
      const apiSecret = decryptData(connection.encrypted_api_secret);
      const refreshToken = decryptData(connection.refresh_token);

      const tokenUrl = `${this.baseURL}/login/authorization/token`;
      
      const formData = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: apiKey,
        client_secret: apiSecret,
        grant_type: 'refresh_token'
      });

      const response = await axios.post(tokenUrl, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      if (response.data && response.data.access_token) {
        logger.info('Upstox access token refreshed successfully');
        return response.data;
      } else {
        throw new Error('Invalid refresh response');
      }

    } catch (error) {
      logger.error('Failed to refresh Upstox access token:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message;
      
      throw new Error(`Token refresh failed: ${errorMessage}`);
    }
  }

  // Initialize Upstox instance for a connection
  async initializeUpstox(brokerConnection) {
    try {
      logger.info(`Initializing Upstox instance for connection ${brokerConnection.id}`);

      if (!brokerConnection.api_key) {
        throw new Error('API key is missing from broker connection');
      }

      if (!brokerConnection.access_token) {
        throw new Error('Access token is missing from broker connection');
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (brokerConnection.access_token_expires_at && brokerConnection.access_token_expires_at < now) {
        throw new Error('Access token has expired. Please refresh your token.');
      }

      const apiKey = decryptData(brokerConnection.api_key);
      const accessToken = decryptData(brokerConnection.access_token);

      const upstoxInstance = {
        apiKey,
        accessToken,
        baseURL: this.baseURL,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      // Test the connection
      await this.testConnection(upstoxInstance);

      this.upstoxInstances.set(brokerConnection.id, upstoxInstance);
      logger.info(`Upstox instance initialized for connection ${brokerConnection.id}`);
      
      return upstoxInstance;
    } catch (error) {
      logger.error('Failed to initialize Upstox instance:', error);
      throw new Error(`Failed to initialize Upstox connection: ${error.message}`);
    }
  }

  // Get or create Upstox instance
  async getUpstoxInstance(brokerConnectionId) {
    logger.info(`Getting Upstox instance for connection ${brokerConnectionId}`);
    
    if (this.upstoxInstances.has(brokerConnectionId)) {
      logger.info('Using cached Upstox instance');
      return this.upstoxInstances.get(brokerConnectionId);
    }

    logger.info('Fetching broker connection from database');
    const brokerConnection = await db.getAsync(
      'SELECT * FROM broker_connections WHERE id = ? AND is_active = 1',
      [brokerConnectionId]
    );

    if (!brokerConnection) {
      logger.error('Broker connection not found or inactive');
      throw new Error('Broker connection not found or inactive');
    }

    logger.info('Broker connection found, initializing Upstox');
    return await this.initializeUpstox(brokerConnection);
  }

  // Test connection
  async testConnection(upstoxInstance) {
    try {
      const response = await axios.get(`${upstoxInstance.baseURL}/user/profile`, {
        headers: upstoxInstance.headers
      });
      
      logger.info('Upstox connection test successful');
      return response.data;
    } catch (error) {
      logger.error('Upstox connection test failed:', error);
      throw new Error(`Connection test failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Place order
  async placeOrder(brokerConnectionId, orderParams) {
    try {
      logger.info(`Placing Upstox order for connection ${brokerConnectionId}`);
      
      const upstoxInstance = await this.getUpstoxInstance(brokerConnectionId);
      
      // Validate required parameters
      if (!orderParams.instrument_token) {
        throw new Error('instrument_token is required for Upstox orders');
      }
      if (!orderParams.transaction_type) {
        throw new Error('transaction_type is required');
      }
      if (!orderParams.quantity) {
        throw new Error('quantity is required');
      }

      // Map order parameters to Upstox format
      const upstoxOrderData = {
        quantity: parseInt(orderParams.quantity),
        product: orderParams.product || 'I', // I = Intraday, D = Delivery, CO = Cover Order, OCO = One Cancels Other
        validity: orderParams.validity || 'DAY',
        price: orderParams.order_type === 'LIMIT' ? parseFloat(orderParams.price || 0) : 0,
        tag: orderParams.tag || 'AutoTraderHub',
        instrument_token: orderParams.instrument_token,
        order_type: orderParams.order_type || 'MARKET',
        transaction_type: orderParams.transaction_type,
        disclosed_quantity: orderParams.disclosed_quantity || 0,
        trigger_price: ['SL', 'SL-M'].includes(orderParams.order_type) ? parseFloat(orderParams.trigger_price || 0) : 0,
        is_amo: orderParams.is_amo || false
      };

      logger.info('Placing order with Upstox API:', upstoxOrderData);
      
      const response = await axios.post(
        `${upstoxInstance.baseURL}/order/place`,
        upstoxOrderData,
        { headers: upstoxInstance.headers }
      );

      logger.info('Upstox order placed successfully:', response.data);
      
      return {
        success: true,
        order_id: response.data.data.order_id,
        data: response.data.data
      };
    } catch (error) {
      logger.error('Failed to place Upstox order:', error);
      throw new Error(`Order placement failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get user profile
  async getProfile(brokerConnectionId) {
    try {
      logger.info(`Getting Upstox profile for connection ${brokerConnectionId}`);
      const upstoxInstance = await this.getUpstoxInstance(brokerConnectionId);
      
      const response = await axios.get(`${upstoxInstance.baseURL}/user/profile`, {
        headers: upstoxInstance.headers
      });
      
      logger.info('Upstox profile retrieved successfully');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get Upstox profile:', error);
      throw new Error(`Failed to get profile: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get positions
  async getPositions(brokerConnectionId) {
    try {
      logger.info(`Getting Upstox positions for connection ${brokerConnectionId}`);
      const upstoxInstance = await this.getUpstoxInstance(brokerConnectionId);
      
      const response = await axios.get(`${upstoxInstance.baseURL}/portfolio/short-term-positions`, {
        headers: upstoxInstance.headers
      });
      
      logger.info('Upstox positions retrieved successfully');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get Upstox positions:', error);
      throw new Error(`Failed to get positions: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get holdings
  async getHoldings(brokerConnectionId) {
    try {
      logger.info(`Getting Upstox holdings for connection ${brokerConnectionId}`);
      const upstoxInstance = await this.getUpstoxInstance(brokerConnectionId);
      
      const response = await axios.get(`${upstoxInstance.baseURL}/portfolio/long-term-holdings`, {
        headers: upstoxInstance.headers
      });
      
      logger.info('Upstox holdings retrieved successfully');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get Upstox holdings:', error);
      throw new Error(`Failed to get holdings: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get orders
  async getOrders(brokerConnectionId) {
    try {
      logger.info(`Getting Upstox orders for connection ${brokerConnectionId}`);
      const upstoxInstance = await this.getUpstoxInstance(brokerConnectionId);
      
      const response = await axios.get(`${upstoxInstance.baseURL}/order/retrieve-all`, {
        headers: upstoxInstance.headers
      });
      
      logger.info('Upstox orders retrieved successfully');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get Upstox orders:', error);
      throw new Error(`Failed to get orders: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get order status
  async getOrderStatus(brokerConnectionId, orderId) {
    try {
      logger.info(`Getting Upstox order status for order ${orderId}`);
      const upstoxInstance = await this.getUpstoxInstance(brokerConnectionId);
      
      const response = await axios.get(`${upstoxInstance.baseURL}/order/details?order_id=${orderId}`, {
        headers: upstoxInstance.headers
      });
      
      logger.info('Upstox order status retrieved successfully');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get Upstox order status:', error);
      throw new Error(`Failed to get order status: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get instrument details
  async getInstrumentToken(symbol, exchange = 'NSE_EQ') {
    try {
      logger.info(`Getting instrument token for ${symbol} on ${exchange}`);
      
      // This would typically require a master contract file or instrument search API
      // For now, we'll return a placeholder - in production, you'd implement proper instrument lookup
      const response = await axios.get(`${this.baseURL}/market-quote/instruments/${exchange}/${symbol}`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      return response.data.data.instrument_token;
    } catch (error) {
      logger.error('Failed to get instrument token:', error);
      throw new Error(`Failed to get instrument token: ${error.response?.data?.message || error.message}`);
    }
  }

  // Clear cached instance
  clearCachedInstance(brokerConnectionId) {
    try {
      if (this.upstoxInstances.has(brokerConnectionId)) {
        this.upstoxInstances.delete(brokerConnectionId);
        logger.info(`Cleared cached Upstox instance for connection ${brokerConnectionId}`);
        console.log(`🗑️ Cleared cached Upstox instance for connection ${brokerConnectionId}`);
        return true;
      } else {
        logger.info(`No cached Upstox instance found for connection ${brokerConnectionId}`);
        console.log(`ℹ️ No cached Upstox instance found for connection ${brokerConnectionId}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error clearing cached Upstox instance: ${error.message}`);
      console.error(`❌ Error clearing cached Upstox instance: ${error.message}`);
      return false;
    }
  }
}

// Utility function to check Upstox API status
async function checkUpstoxApiStatus() {
  const upstoxService = new UpstoxService();
  try {
    const response = await axios.get(`${upstoxService.baseURL}/status`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AutoTraderHub/1.0'
      },
      timeout: 10000
    });
    
    return {
      status: 'success',
      apiStatus: response.data,
      statusCode: response.status,
      message: 'Upstox API is available'
    };
  } catch (error) {
    return {
      status: 'error',
      statusCode: error.response?.status,
      message: error.message,
      error: error.response?.data || error.message
    };
  }
}

const upstoxServiceInstance = new UpstoxService();
export { checkUpstoxApiStatus };
export default upstoxServiceInstance;