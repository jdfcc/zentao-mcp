import axios, { AxiosError } from 'axios';
import https from 'https';
import {
  ZentaoConfig,
  ZentaoApiResponse,
  ProjectsResponse,
  BugsResponse,
  BugDetailResponse
} from '../types.js';
import {
  API_TIMEOUT,
  DEFAULT_TTL_SECONDS
} from '../constants.js';

class ZentaoClient {
  private config: ZentaoConfig;
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private baseUrl: string;
  private axiosInstance: any;

  constructor(config: ZentaoConfig) {
    this.config = config;
    this.baseUrl = config.zentaoUrl.replace(/\/$/, '');
    
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    });

    this.axiosInstance = axios.create({
      httpsAgent,
      timeout: API_TIMEOUT
    });
  }

  private log(message: string, level: string = 'info'): void {
    if (this.config.logLevel === 'debug' || level === 'error') {
      const prefix = level.toUpperCase();
      console.error(`[${prefix}] ${message}`);
    }
  }

  private isTokenExpired(): boolean {
    return !this.token || Date.now() >= this.tokenExpiry;
  }

  private async ensureToken(): Promise<void> {
    if (this.isTokenExpired()) {
      await this.refreshToken();
    }
  }

  private async refreshToken(): Promise<void> {
    try {
      const loginUrl = `${this.baseUrl}/api.php/v1/tokens`;
      this.log(`Refreshing token... URL: ${loginUrl}`);
      this.log(`Username: ${this.config.username}`);
      const response = await this.axiosInstance.post(
        loginUrl,
        {
          account: this.config.username,
          password: this.config.password
        },
        {
          timeout: API_TIMEOUT,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      this.log(`Response status: ${response.status}`);
      this.log(`Response data: ${JSON.stringify(response.data)}`);

      if (response.data.token) {
        this.token = response.data.token;
        this.tokenExpiry = Date.now() + (this.config.ttlSeconds || DEFAULT_TTL_SECONDS) * 1000;
        this.log('Token refreshed successfully');
      } else {
        throw new Error(`Authentication failed: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      this.log(`Error during token refresh: ${error instanceof Error ? error.message : String(error)}`, 'error');
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.log(`Axios error status: ${axiosError.response?.status}`, 'error');
        this.log(`Axios error data: ${JSON.stringify(axiosError.response?.data)}`, 'error');
        if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
          throw new Error('Authentication failed: Invalid username or password');
        }
      }
      throw error;
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.token) {
      headers['token'] = this.token;
    }

    return headers;
  }

  private handleApiError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data as any;

        switch (status) {
          case 401:
          case 403:
            this.token = null;
            throw new Error('AUTH_ERROR: Authentication failed. Please check your username and password, or verify ZENTAO_URL is correct.');

          case 404:
            throw new Error('INVALID_PARAMETER: Resource not found. Please check the ID is correct.');

          case 429:
            throw new Error('API_ERROR: Rate limit exceeded. Please wait before making more requests.');

          default:
            if (data && data.message) {
              throw new Error(`API_ERROR: ${data.message}`);
            }
            throw new Error(`API_ERROR: API request failed with status ${status}`);
        }
      } else if (axiosError.code === 'ECONNABORTED') {
        throw new Error('NETWORK_ERROR: Request timed out. Please try again.');
      } else if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        throw new Error('NETWORK_ERROR: Cannot connect to Zentao server. Please check network connection and ZENTAO_URL.');
      }
    }

    if (error instanceof Error) {
      throw new Error(`NETWORK_ERROR: ${error.message}`);
    }

    throw new Error('NETWORK_ERROR: Unexpected error occurred');
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: any,
    params?: any
  ): Promise<T> {
    try {
      await this.ensureToken();

      const response = await this.axiosInstance({
        method,
        url: `${this.baseUrl}${endpoint}`,
        data,
        params,
        headers: this.getHeaders()
      });

      return response.data;
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async getProjects(): Promise<ProjectsResponse> {
    const response = await this.makeRequest<ProjectsResponse>('GET', '/api.php/v1/projects');
    // 禅道 API 直接返回分页数据，无需包装 status/message
    return response;
  }

  async getProjectBugs(projectId: number, params?: any): Promise<BugsResponse> {
    const response = await this.makeRequest<BugsResponse>('GET', `/api.php/v1/projects/${projectId}/bugs`, undefined, params);
    // 禅道 API 直接返回分页数据，无需包装 status/message
    return response;
  }

  async getBugDetails(bugId: number): Promise<BugDetailResponse> {
    const response = await this.makeRequest<BugDetailResponse>('GET', `/api.php/v1/bugs/${bugId}`);
    // Bug detail API 返回 bug 对象本身
    return response;
  }
}

export default ZentaoClient;
