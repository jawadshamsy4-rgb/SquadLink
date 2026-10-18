import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Ionicons } from '@expo/vector-icons'

interface Server {
  id: string
  name: string
  icon_url: string
}

interface Channel {
  id: string
  name: string
  type: 'text' | 'voice' | 'map'
}

interface Message {
  id: string
  content: string
  created_at: string
  users: { username: string }
}

export default function HomeScreen() {
  const [servers, setServers] = useState<Server[]>([])
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageText, setMessageText] = useState('')
  const [showCreateServer, setShowCreateServer] = useState(false)
  const [newServerName, setNewServerName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Load servers
  const loadServers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('server_members')
      .select('servers(*)')
      .eq('user_id', user.id)

    if (data) {
      setServers(data.map((d: any) => d.servers).filter(Boolean))
    }
  }, [])

  useEffect(() => {
    loadServers()
  }, [loadServers])

  // Load channels when server selected
  useEffect(() => {
    if (!selectedServer) return
    const loadChannels = async () => {
      const { data } = await supabase
        .from('channels')
        .select('*')
        .eq('server_id', selectedServer.id)
        .order('position')
      if (data) setChannels(data)
    }
    loadChannels()
  }, [selectedServer])

  // Load and subscribe to messages when channel selected
  useEffect(() => {
    if (!selectedChannel || selectedChannel.type !== 'text') return

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, users(username)')
        .eq('channel_id', selectedChannel.id)
        .order('created_at', { ascending: true })
        .limit(50)
      if (data) setMessages(data)
    }
    loadMessages()

    const subscription = supabase
      .channel(`messages:${selectedChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${selectedChannel.id}`,
      }, async (payload) => {
        const { data: newMsg } = await supabase
          .from('messages')
          .select('*, users(username)')
          .eq('id', payload.new.id)
          .single()
        if (newMsg) {
          setMessages(prev => [...prev, newMsg])
        }
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [selectedChannel])

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedChannel) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('messages').insert({
      channel_id: selectedChannel.id,
      user_id: user.id,
      content: messageText.trim(),
    })
    setMessageText('')
  }

  const createServer = async () => {
    if (!newServerName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('servers').insert({
      name: newServerName.trim(),
      owner_id: user.id,
    })
    setNewServerName('')
    setShowCreateServer(false)
    loadServers()
  }

  const joinServer = async () => {
    if (!inviteCode.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: server } = await supabase
      .from('servers')
      .select('id')
      .eq('invite_code', inviteCode.trim())
      .single()

    if (server) {
      await supabase.from('server_members').insert({
        server_id: server.id,
        user_id: user.id,
      })
      setInviteCode('')
      setShowCreateServer(false)
      loadServers()
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  // Render channel icon
  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'voice': return 'volume-high'
      case 'map': return 'globe'
      default: return 'chatbubble'
    }
  }

  // Main view: Server list
  if (!selectedServer) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SquadLink</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {showCreateServer ? (
          <View style={styles.createForm}>
            <Text style={styles.formTitle}>Create or Join Server</Text>
            <TextInput
              style={styles.input}
              placeholder="Server name"
              placeholderTextColor="#666"
              value={newServerName}
              onChangeText={setNewServerName}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={createServer}>
              <Text style={styles.buttonText}>Create Server</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TextInput
              style={styles.input}
              placeholder="Invite code"
              placeholderTextColor="#666"
              value={inviteCode}
              onChangeText={setInviteCode}
            />
            <TouchableOpacity style={styles.secondaryButton} onPress={joinServer}>
              <Text style={styles.buttonText}>Join Server</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowCreateServer(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: '#9ca3af', textAlign: 'center' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              data={servers}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadServers} tintColor="#a855f7" />}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.serverCard}
                  onPress={() => setSelectedServer(item)}
                >
                  <View style={styles.serverIcon}>
                    <Text style={styles.serverInitial}>{item.name[0].toUpperCase()}</Text>
                  </View>
                  <Text style={styles.serverName}>{item.name}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>🎮</Text>
                  <Text style={styles.emptyTitle}>No servers yet</Text>
                  <Text style={styles.emptySubtitle}>Create or join a server to get started</Text>
                </View>
              }
            />
            <TouchableOpacity
              style={styles.fab}
              onPress={() => setShowCreateServer(true)}
            >
              <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>
    )
  }

  // Channel list view
  if (!selectedChannel) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedServer(null)}>
            <Ionicons name="arrow-back" size={24} color="#c084fc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedServer.name}</Text>
          <View style={{ width: 24 }} />
        </View>

        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.channelCard}
              onPress={() => setSelectedChannel(item)}
            >
              <Ionicons name={getChannelIcon(item.type) as any} size={20} color="#a855f7" />
              <Text style={styles.channelName}>{item.name}</Text>
              <View style={[styles.channelBadge, { backgroundColor: item.type === 'voice' ? '#059669' : item.type === 'map' ? '#0891b2' : '#7c3aed' }]}>
                <Text style={styles.channelBadgeText}>{item.type}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    )
  }

  // Chat view
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSelectedChannel(null)}>
          <Ionicons name="arrow-back" size={24} color="#c084fc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>#{selectedChannel.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        renderItem={({ item }) => (
          <View style={styles.messageRow}>
            <View style={styles.messageAvatar}>
              <Text style={styles.avatarText}>
                {item.users?.username?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <View style={styles.messageContent}>
              <Text style={styles.messageUsername}>{item.users?.username || 'Unknown'}</Text>
              <Text style={styles.messageText}>{item.content}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.chatInput}
          placeholder={`Message #${selectedChannel.name}`}
          placeholderTextColor="#666"
          value={messageText}
          onChangeText={setMessageText}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#e2e8f0' },
  serverCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  serverIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  serverInitial: { fontSize: 20, fontWeight: '800', color: '#fff' },
  serverName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#e2e8f0' },
  channelCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  channelName: { flex: 1, fontSize: 16, fontWeight: '500', color: '#e2e8f0', marginLeft: 12 },
  channelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  channelBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  messageRow: { flexDirection: 'row', marginBottom: 16 },
  messageAvatar: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  messageContent: { flex: 1 },
  messageUsername: { color: '#c084fc', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  messageText: { color: '#e2e8f0', fontSize: 15, lineHeight: 20 },
  inputBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', padding: 12,
    backgroundColor: 'rgba(10,10,10,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  chatInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    color: '#fff', fontSize: 15, marginRight: 8,
  },
  sendButton: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center',
  },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#e2e8f0', marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: '#9ca3af' },
  createForm: { padding: 24 },
  formTitle: { fontSize: 22, fontWeight: '800', color: '#e2e8f0', marginBottom: 20 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 16, marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#7c3aed', borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#0891b2', borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: '#666', paddingHorizontal: 12, fontSize: 14 },
})
