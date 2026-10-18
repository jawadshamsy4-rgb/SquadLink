export interface User {
  id: string
  username: string
  avatar_url: string
  email: string
  created_at: string
}

export interface Server {
  id: string
  name: string
  icon_url: string
  invite_code: string
  owner_id: string
  created_at: string
}

export interface ServerMember {
  id: string
  server_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
  users?: User
}

export interface Channel {
  id: string
  server_id: string
  name: string
  type: 'text' | 'voice' | 'map'
  position: number
  created_at: string
}

export interface Message {
  id: string
  channel_id: string
  user_id: string
  content: string
  created_at: string
  users?: User
}

export interface Location {
  id: string
  user_id: string
  server_id: string
  latitude: number
  longitude: number
  is_sharing_location: boolean
  updated_at: string
  users?: User
}
