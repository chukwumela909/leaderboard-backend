// services/pusherService.ts
import Pusher from 'pusher';

interface PusherConfig {
  appId: string;
  key: string;
  secret: string;
  cluster: string;
  useTLS?: boolean;
}

class PusherService {
  private static instance: PusherService;
  private pusher: Pusher;

  private constructor(config: PusherConfig) {
    this.pusher = new Pusher({
      appId: config.appId,
      key: config.key,
      secret: config.secret,
      cluster: config.cluster,
      useTLS: config.useTLS ?? true,
    });
  }

  public static getInstance(config?: PusherConfig): PusherService {
    if (!PusherService.instance) {
      if (!config) {
        throw new Error('Pusher configuration is required for first initialization');
      }
      PusherService.instance = new PusherService(config);
    }
    return PusherService.instance;
  }

  // Method to trigger events
  public async trigger(
    channel: string | string[],
    event: string,
    data: any,
    socketId?: string
  ): Promise<void> {
    try {
      await this.pusher.trigger(channel, event, data);
    } catch (error) {
      console.error('Error triggering Pusher event:', error);
      throw error;
    }
  }

  // Method to trigger events to multiple channels
  public async triggerBatch(events: Array<{
    channel: string;
    name: string;
    data: any;
  }>): Promise<void> {
    try {
      await this.pusher.triggerBatch(events);
    } catch (error) {
      console.error('Error triggering batch Pusher events:', error);
      throw error;
    }
  }

  // Method to authenticate private channels
  public authenticate(socketId: string, channel: string, presenceData?: any) {
    if (channel.startsWith('presence-')) {
      return this.pusher.authenticateUser(socketId, presenceData);
    } else {
      return this.pusher.authenticate(socketId, channel);
    }
  }

  // Method to get channel info
  public async getChannelInfo(channel: string, info?: string[]): Promise<any> {
    try {
      return await this.pusher.get({ path: `/channels/${channel}`, params: { info: info?.join(',') } });
    } catch (error) {
      console.error('Error getting channel info:', error);
      throw error;
    }
  }

  // Method to get all channels
  public async getChannels(prefix?: string): Promise<any> {
    try {
      const params = prefix ? { filter_by_prefix: prefix } : {};
      return await this.pusher.get({ path: '/channels', params });
    } catch (error) {
      console.error('Error getting channels:', error);
      throw error;
    }
  }

  // Method to get users in presence channel
  public async getPresenceUsers(channel: string): Promise<any> {
    try {
      return await this.pusher.get({ path: `/channels/${channel}/users` });
    } catch (error) {
      console.error('Error getting presence users:', error);
      throw error;
    }
  }

  // Method to send to user (requires Push Notifications feature)
  public async sendToUser(userId: string, event: string, data: any): Promise<void> {
    try {
      await this.pusher.sendToUser(userId, event, data);
    } catch (error) {
      console.error('Error sending to user:', error);
      throw error;
    }
  }

  // Get the raw Pusher instance if needed
  public getPusherInstance(): Pusher {
    return this.pusher;
  }
}

export default PusherService;