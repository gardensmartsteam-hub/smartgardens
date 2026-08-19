export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          created_at: string
          id: string
          message: string
          metric: string
          plant_id: string
          resolved: boolean
          severity: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metric: string
          plant_id: string
          resolved?: boolean
          severity?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metric?: string
          plant_id?: string
          resolved?: boolean
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          battery: number | null
          created_at: string
          device_id: string
          device_key: string
          dry_raw: number
          id: string
          last_seen_at: string | null
          name: string
          plant_id: string | null
          require_key: boolean
          status: string
          updated_at: string
          user_id: string
          wet_raw: number
        }
        Insert: {
          battery?: number | null
          created_at?: string
          device_id: string
          device_key?: string
          dry_raw?: number
          id?: string
          last_seen_at?: string | null
          name?: string
          plant_id?: string | null
          require_key?: boolean
          status?: string
          updated_at?: string
          user_id: string
          wet_raw?: number
        }
        Update: {
          battery?: number | null
          created_at?: string
          device_id?: string
          device_key?: string
          dry_raw?: number
          id?: string
          last_seen_at?: string | null
          name?: string
          plant_id?: string | null
          require_key?: boolean
          status?: string
          updated_at?: string
          user_id?: string
          wet_raw?: number
        }
        Relationships: [
          {
            foreignKeyName: "devices_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      plants: {
        Row: {
          created_at: string
          id: string
          location: string
          name: string
          species_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string
          name: string
          species_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string
          name?: string
          species_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plants_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      readings: {
        Row: {
          battery: number | null
          device_id: string | null
          humidity: number
          id: string
          light: number | null
          nutrients: number | null
          plant_id: string
          recorded_at: string
          temperature: number | null
          user_id: string
        }
        Insert: {
          battery?: number | null
          device_id?: string | null
          humidity: number
          id?: string
          light?: number | null
          nutrients?: number | null
          plant_id: string
          recorded_at?: string
          temperature?: number | null
          user_id: string
        }
        Update: {
          battery?: number | null
          device_id?: string | null
          humidity?: number
          id?: string
          light?: number | null
          nutrients?: number | null
          plant_id?: string
          recorded_at?: string
          temperature?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readings_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      species: {
        Row: {
          care_tip: string
          common_name: string
          humidity_max: number
          humidity_min: number
          id: string
          light_max: number
          light_min: number
          nutrients_max: number
          nutrients_min: number
          scientific_name: string
          temp_max: number
          temp_min: number
        }
        Insert: {
          care_tip: string
          common_name: string
          humidity_max: number
          humidity_min: number
          id?: string
          light_max: number
          light_min: number
          nutrients_max: number
          nutrients_min: number
          scientific_name: string
          temp_max: number
          temp_min: number
        }
        Update: {
          care_tip?: string
          common_name?: string
          humidity_max?: number
          humidity_min?: number
          id?: string
          light_max?: number
          light_min?: number
          nutrients_max?: number
          nutrients_min?: number
          scientific_name?: string
          temp_max?: number
          temp_min?: number
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          accepted_at: string
          cookie_consent: boolean
          privacy_version: string
          terms_version: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          cookie_consent?: boolean
          privacy_version: string
          terms_version: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          cookie_consent?: boolean
          privacy_version?: string
          terms_version?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
