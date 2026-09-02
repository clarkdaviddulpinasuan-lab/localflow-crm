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
          start_time: string
          end_time: string
          guests: number
          status: string
          amount: number
          payment_status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          customer_id: string
          resource: string
          date: string
          start_time: string
          end_time: string
          guests?: number
          status?: string
          amount?: number
          payment_status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          customer_id?: string
          resource?: string
          date?: string
          start_time?: string
          end_time?: string
          guests?: number
          status?: string
          amount?: number
          payment_status?: string
          notes?: string | null
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
