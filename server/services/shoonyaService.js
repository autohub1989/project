import axios from 'axios';
import crypto from 'crypto';
import { db } from '../database/init.js';
import { encryptData, decryptData } from '../utils/encryption.js';
import { createLogger } from '../utils/logger.js';
import { NorenRestApi } from 'Shoonya-Dev/ShoonyaApi-js';

const logger = createLogger('ShoonyaService');

class ShoonyaService {
  constructor() {
    this.shoonyaInstances = new Map();
    this.baseURL = 'https://api.shoonya.com';
  }

  async generateSessionToken(apiKey, userId, password, twoFA, vendor_code, api_secret, imei) {
    try {
      logger.info('Generating Shoonya session token using SDK');

      const njs = new NorenRestApi();

      const appkey = `${userId}|${api_secret}`;

      const loginResponse = await njs.login({
        uid: userId,
        pwd: password,
        factor2: twoFA,
        vc: vendor_code,
        appkey: appkey,
        imei: imei || 'abc1234',
        source: 'API'
      });

      if (loginResponse.stat === 'Ok') {
        logger.info('Shoonya session token generated successfully');
        return {
          access_token: loginResponse.susertoken,
          session_token: loginResponse.susertoken
        };
      } else {
        logger.error('Shoonya login failed:', loginResponse);
        throw new Error(loginResponse.emsg || 'Shoonya login failed');
      }

    } catch (error) {
      logger.error('Failed to generate Shoonya session token:', {
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });

      throw new Error(`Failed to generate session token: ${error.response?.data?.emsg || error.message}`);
    }
  }

  async initializeShoonya(brokerConnection) {
    try {
      logger.info(`Initializing Shoonya instance for connection ${brokerConnection.id}`);

      if (!brokerConnection.api_key || !brokerConnection.access_token) {
        throw new Error('API key or access token missing from broker connection');
      }

      const now = Math.floor(Date.now() / 1000);
      if (brokerConnection.access_token_expires_at && brokerConnection.access_token_expires_at < now) {
        throw new Error('Session token has expired. Please refresh your token.');
      }

      const apiKey = decryptData(brokerConnection.api_key);
      const sessionToken = decryptData(brokerConnection.access_token);

      const shoonyaInstance = {
        apiKey,
        sessionToken,
        userId: brokerConnection.username,
        baseURL: this.baseURL,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

      await this.testConnection(shoonyaInstance);

      this.shoonyaInstances.set(brokerConnection.id, shoonyaInstance);
      logger.info(`Shoonya instance initialized for connection ${brokerConnection.id}`);

      return shoonyaInstance;
    } catch (error) {
      logger.error('Failed to initialize Shoonya instance:', error);
      throw new Error(`Failed to initialize Shoonya connection: ${error.message}`);
    }
  }

  async getShoonyaInstance(brokerConnectionId) {
    logger.info(`Getting Shoonya instance for connection ${brokerConnectionId}`);

    if (this.shoonyaInstances.has(brokerConnectionId)) {
      logger.info('Using cached Shoonya instance');
      return this.shoonyaInstances.get(brokerConnectionId);
    }

    const brokerConnection = await db.getAsync(
      'SELECT * FROM broker_connections WHERE id = ? AND is_active = 1',
      [brokerConnectionId]
    );

    if (!brokerConnection) {
      throw new Error('Broker connection not found or inactive');
    }

    return await this.initializeShoonya(brokerConnection);
  }

  async makeApiCall(shoonyaInstance, endpoint, data = {}) {
    const requestData = {
      ...data,
      uid: shoonyaInstance.userId || data.uid,
      actid: shoonyaInstance.userId || data.actid || data.uid
    };

    if (shoonyaInstance.sessionToken) {
      requestData.token = shoonyaInstance.sessionToken;
    }

    const response = await axios.post(`${shoonyaInstance.baseURL}${endpoint}`, requestData, {
      headers: shoonyaInstance.headers,
      transformRequest: [(data) =>
        Object.keys(data).map(key => `${key}=${encodeURIComponent(data[key])}`).join('&')
      ]
    });

    if (response.data.stat === 'Ok') {
      return response.data;
    } else {
      throw new Error(response.data.emsg || 'API call failed');
    }
  }

  async testConnection(shoonyaInstance) {
    try {
      const response = await this.makeApiCall(shoonyaInstance, '/NorenWClientTP/UserDetails');
      return response;
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  async placeOrder(brokerConnectionId, orderParams) {
    try {
      const shoonyaInstance = await this.getShoonyaInstance(brokerConnectionId);

      const shoonyaOrderData = {
        uid: shoonyaInstance.userId,
        actid: shoonyaInstance.userId,
        exch: orderParams.exch || 'NSE',
        tsym: orderParams.tsym,
        qty: parseInt(orderParams.qty),
        prc: orderParams.prctyp === 'LMT' ? parseFloat(orderParams.prc || 0).toString() : '0',
        prd: orderParams.prd || 'I',
        trantype: orderParams.trantype,
        prctyp: orderParams.prctyp || 'MKT',
        ret: orderParams.ret || 'DAY',
        ordersource: 'API'
      };

      if (['SL-LMT', 'SL-MKT'].includes(orderParams.prctyp) && orderParams.trgprc) {
        shoonyaOrderData.trgprc = parseFloat(orderParams.trgprc).toString();
      }

      const response = await this.makeApiCall(shoonyaInstance, '/NorenWClientTP/PlaceOrder', shoonyaOrderData);

      return {
        success: true,
        order_id: response.norenordno,
        data: response
      };
    } catch (error) {
      throw new Error(`Order placement failed: ${error.message}`);
    }
  }

  async getProfile(brokerConnectionId) {
    const shoonyaInstance = await this.getShoonyaInstance(brokerConnectionId);
    return this.makeApiCall(shoonyaInstance, '/NorenWClientTP/UserDetails');
  }

  async getPositions(brokerConnectionId) {
    const shoonyaInstance = await this.getShoonyaInstance(brokerConnectionId);
    return this.makeApiCall(shoonyaInstance, '/NorenWClientTP/PositionBook');
  }

  async getHoldings(brokerConnectionId) {
    const shoonyaInstance = await this.getShoonyaInstance(brokerConnectionId);
    return this.makeApiCall(shoonyaInstance, '/NorenWClientTP/Holdings');
  }

  async getOrders(brokerConnectionId) {
    const shoonyaInstance = await this.getShoonyaInstance(brokerConnectionId);
    return this.makeApiCall(shoonyaInstance, '/NorenWClientTP/OrderBook');
  }

  async getOrderStatus(brokerConnectionId, orderId) {
    const shoonyaInstance = await this.getShoonyaInstance(brokerConnectionId);
    return this.makeApiCall(shoonyaInstance, '/NorenWClientTP/SingleOrdHist', {
      norenordno: orderId
    });
  }

  async getInstruments(brokerConnectionId, exchange = 'NSE') {
    const shoonyaInstance = await this.getShoonyaInstance(brokerConnectionId);
    return this.makeApiCall(shoonyaInstance, '/NorenWClientTP/SearchScrip', {
      exch: exchange,
      stext: ''
    });
  }

  async searchSymbol(brokerConnectionId, symbol, exchange = 'NSE') {
    const shoonyaInstance = await this.getShoonyaInstance(brokerConnectionId);
    return this.makeApiCall(shoonyaInstance, '/NorenWClientTP/SearchScrip', {
      exch: exchange,
      stext: symbol
    });
  }

  async getMarketData(brokerConnectionId, exchange, token) {
    const shoonyaInstance = await this.getShoonyaInstance(brokerConnectionId);
    return this.makeApiCall(shoonyaInstance, '/NorenWClientTP/GetQuotes', {
      exch: exchange,
      token: token
    });
  }

  clearCachedInstance(brokerConnectionId) {
    if (this.shoonyaInstances.has(brokerConnectionId)) {
      this.shoonyaInstances.delete(brokerConnectionId);
      logger.info(`Cleared cached Shoonya instance for connection ${brokerConnectionId}`);
    }
  }
}

export default new ShoonyaService();
