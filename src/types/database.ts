export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          name: string
          type: string
          location: string
          currency: string
          timezone: string
          team_size: number
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          location: string
          currency?: string
          timezone?: string
          team_size?: number
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          location?: string
          currency?: string
          timezone?: string
          team_size?: number
          logo_url?: string | null
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          business_id: string
          first_name: string
          last_name: string
          email: string
          phone: string | null
          role: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          business_id: string
          first_name: string
          last_name: string
          email: string
          phone?: string | null
          role?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          role?: string
          avatar_url?: string | null
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          business_id: string
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          type: string
          status: string
          total_spent: number
          visit_count: number
          last_activity: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          first_name: string
          last_name: string
          email?: string | null
          phone?: string | null
          type?: string
          status?: string
          total_spent?: number
          visit_count?: number
          last_activity?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          first_name?: string
          last_name?: string
          email?: string | null
          phone?: string | null
          type?: string
          status?: string
          total_spent?: number
          visit_count?: number
          last_activity?: string
          notes?: string | null
          updated_at?: string
        }
      }
      customer_notes: {
        Row: {
          id: string
          customer_id: string
          business_id: string
          author_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          business_id: string
          author_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          content?: string
          updated_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          business_id: string
          customer_id: string
          resource: string
          date: string
          end_date: string | null
          start_time: string
          end_time: string
          guests: number
          status: string
          amount: number
          payment_status: string
          notes: string | null
          check_in_date: string | null
          check_in_time: string | null
          check_out_date: string | null
          check_out_time: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          customer_id: string
          resource: string
          date: string
          end_date?: string | null
          start_time: string
          end_time: string
          guests?: number
          status?: string
          amount?: number
          payment_status?: string
          notes?: string | null
          check_in_date?: string | null
          check_in_time?: string | null
          check_out_date?: string | null
          check_out_time?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          customer_id?: string
          resource?: string
          date?: string
          end_date?: string | null
          start_time?: string
          end_time?: string
          guests?: number
          status?: string
          amount?: number
          payment_status?: string
          notes?: string | null
          check_in_date?: string | null
          check_in_time?: string | null
          check_out_date?: string | null
          check_out_time?: string | null
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          business_id: string
          customer_id: string
          order_number: string
          items: string
          description: string | null
          start_date: string | null
          end_date: string | null
          total: number
          payment_status: string
          status: string
          staff_member: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          customer_id: string
          order_number: string
          items: string
          description?: string | null
          start_date?: string | null
          end_date?: string | null
          total?: number
          payment_status?: string
          status?: string
          staff_member: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          items?: string
          description?: string | null
          start_date?: string | null
          end_date?: string | null
          total?: number
          payment_status?: string
          status?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          business_id: string
          customer_id: string | null
          title: string
          description: string | null
          due_date: string
          priority: string
          status: string
          assignee_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          customer_id?: string | null
          title: string
          description?: string | null
          due_date: string
          priority?: string
          status?: string
          assignee_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          due_date?: string
          priority?: string
          status?: string
          assignee_id?: string | null
          updated_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          business_id: string
          name: string
          company: string | null
          phone: string | null
          email: string | null
          source: string | null
          stage: string
          estimated_value: number
          next_action: string | null
          assigned_staff: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          company?: string | null
          phone?: string | null
          email?: string | null
          source?: string | null
          stage?: string
          estimated_value?: number
          next_action?: string | null
          assigned_staff?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          company?: string | null
          phone?: string | null
          email?: string | null
          source?: string | null
          stage?: string
          estimated_value?: number
          next_action?: string | null
          assigned_staff?: string | null
          updated_at?: string
        }
      }
      activities: {
        Row: {
          id: string
          business_id: string
          user_id: string
          action: string
          entity_type: string
          entity_id: string
          description: string
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          user_id: string
          action: string
          entity_type: string
          entity_id: string
          description: string
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          description?: string
          metadata?: Record<string, unknown> | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          business_id: string
          title: string
          message: string
          type: string
          read: boolean
          entity_type: string | null
          entity_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          business_id: string
          title: string
          message: string
          type: string
          read?: boolean
          entity_type?: string | null
          entity_id?: string | null
          created_at?: string
        }
        Update: {
          read?: boolean
        }
      }
      message_templates: {
        Row: {
          id: string
          business_id: string
          name: string
          channel: string
          subject: string | null
          body: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          channel?: string
          subject?: string | null
          body: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          channel?: string
          subject?: string | null
          body?: string
          updated_at?: string
        }
      }
      communications: {
        Row: {
          id: string
          business_id: string
          customer_id: string
          channel: string
          template_id: string | null
          subject: string | null
          body: string
          status: string
          provider: string | null
          provider_message_id: string | null
          error: string | null
          sent_at: string
          delivered_at: string | null
        }
        Insert: {
          id?: string
          business_id: string
          customer_id: string
          channel: string
          template_id?: string | null
          subject?: string | null
          body: string
          status?: string
          provider?: string | null
          provider_message_id?: string | null
          error?: string | null
          sent_at?: string
          delivered_at?: string | null
        }
        Update: {
          status?: string
          provider?: string | null
          provider_message_id?: string | null
          error?: string | null
          delivered_at?: string | null
        }
      }
      settings: {
        Row: {
          id: string
          business_id: string
          key: string
          value: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          key: string
          value: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          value?: string
          updated_at?: string
        }
      }
      resources: {
        Row: {
          id: string
          business_id: string
          name: string
          type: string
          color: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          type?: string
          color?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          type?: string
          color?: string | null
          active?: boolean
          updated_at?: string
        }
      }
      booking_items: {
        Row: {
          id: string
          business_id: string
          booking_id: string
          name: string
          quantity: number
          unit_price: number
          total: number
          category: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          booking_id: string
          name: string
          quantity?: number
          unit_price?: number
          total?: number
          category?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          quantity?: number
          unit_price?: number
          total?: number
          category?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_business_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      template_channel: 'email' | 'sms'
      communication_status: 'pending' | 'sent' | 'delivered' | 'failed'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
