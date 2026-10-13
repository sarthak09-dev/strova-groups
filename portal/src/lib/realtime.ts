/**
 * Strova Group Portal — Real-time Subscription Manager
 * Uses Supabase Realtime (PostgreSQL Changes) for live updates.
 */
import { supabase } from './supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

const activeChannels: Map<string, RealtimeChannel> = new Map();

/**
 * Subscribe to new messages for a specific order.
 */
export function subscribeToOrderMessages(
  orderId: string,
  onNewMessage: (message: any) => void
): RealtimeChannel | null {
  if (!supabase) return null;
  const channelName = `messages:order:${orderId}`;
  
  // Don't duplicate subscriptions
  if (activeChannels.has(channelName)) {
    return activeChannels.get(channelName)!;
  }
  
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => onNewMessage(payload.new)
    )
    .subscribe();
  
  activeChannels.set(channelName, channel);
  return channel;
}

/**
 * Subscribe to notifications for the current user.
 */
export function subscribeToNotifications(
  userId: string,
  onNewNotification: (notification: any) => void
): RealtimeChannel | null {
  if (!supabase) return null;
  const channelName = `notifications:${userId}`;
  
  if (activeChannels.has(channelName)) {
    return activeChannels.get(channelName)!;
  }
  
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onNewNotification(payload.new)
    )
    .subscribe();
  
  activeChannels.set(channelName, channel);
  return channel;
}

/**
 * Subscribe to support ticket response updates.
 */
export function subscribeToSupportResponses(
  ticketIds: string[],
  onNewResponse: (response: any) => void
): RealtimeChannel | null {
  if (!supabase || ticketIds.length === 0) return null;
  const channelName = `support:responses`;
  
  if (activeChannels.has(channelName)) {
    return activeChannels.get(channelName)!;
  }
  
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'support_responses',
      },
      (payload) => {
        // Client-side filter since we can't use IN filter in realtime
        if (ticketIds.includes(payload.new.ticket_id)) {
          onNewResponse(payload.new);
        }
      }
    )
    .subscribe();
  
  activeChannels.set(channelName, channel);
  return channel;
}

/**
 * Subscribe to order event updates for a specific order.
 */
export function subscribeToOrderEvents(
  orderId: string,
  onNewEvent: (event: any) => void
): RealtimeChannel | null {
  if (!supabase) return null;
  const channelName = `order_events:${orderId}`;
  
  if (activeChannels.has(channelName)) {
    return activeChannels.get(channelName)!;
  }
  
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'order_events',
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => onNewEvent(payload.new)
    )
    .subscribe();
  
  activeChannels.set(channelName, channel);
  return channel;
}

/**
 * Unsubscribe from a specific channel.
 */
export function unsubscribe(channelName: string): void {
  const channel = activeChannels.get(channelName);
  if (channel && supabase) {
    supabase.removeChannel(channel);
    activeChannels.delete(channelName);
  }
}

/**
 * Unsubscribe from all active channels.
 */
export function unsubscribeAll(): void {
  if (!supabase) return;
  activeChannels.forEach((channel) => {
    supabase!.removeChannel(channel);
  });
  activeChannels.clear();
}
