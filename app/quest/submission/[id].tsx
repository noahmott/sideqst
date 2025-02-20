import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth/AuthContext';
import type { QuestSubmission } from '../../../lib/types/quest';

interface Comment {
  id: string;
  user_id: string;
  submission_id: string;
  comment_text: string;
  created_at: string;
  profile: {
    username: string;
    avatar_url: string | null;
  };
}

export default function SubmissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<QuestSubmission | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    loadSubmissionDetails();
  }, [id]);

  const loadSubmissionDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch submission details
      const { data: submissionData, error: submissionError } = await supabase
        .from('quest_submissions')
        .select(`
          *,
          quest:quests (
            title
          )
        `)
        .eq('id', id)
        .single();

      if (submissionError) throw submissionError;
      setSubmission(submissionData);

      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select(`
          *,
          profile:profiles (
            username,
            avatar_url
          )
        `)
        .eq('submission_id', id)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;
      setComments(commentsData || []);
    } catch (error) {
      console.error('Error loading submission details:', error);
      Alert.alert('Error', 'Failed to load submission details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!user || !newComment.trim()) return;

    try {
      setSubmitting(true);
      const { data, error } = await supabase
        .from('comments')
        .insert([{
          user_id: user.id,
          submission_id: id,
          comment_text: newComment.trim(),
        }])
        .select(`
          *,
          profile:profiles (
            username,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      setComments([...comments, data]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!submission) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome5 name="exclamation-circle" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>Submission not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={() => router.back()}
      >
        <FontAwesome5 name="times" size={24} color="#000" />
      </TouchableOpacity>

      <ScrollView style={styles.content}>
        <Image 
          source={{ uri: submission.image_url }}
          style={styles.image}
          resizeMode="contain"
        />

        <BlurView intensity={80} style={styles.detailsCard}>
          <Text style={styles.questTitle}>
            {submission.quest?.title || 'Quest Submission'}
          </Text>
          {submission.caption && (
            <Text style={styles.caption}>{submission.caption}</Text>
          )}
        </BlurView>

        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>Comments</Text>
          {comments.map((comment) => (
            <BlurView key={comment.id} intensity={80} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                {comment.profile.avatar_url ? (
                  <Image 
                    source={{ uri: comment.profile.avatar_url }}
                    style={styles.commentAvatar}
                  />
                ) : (
                  <View style={styles.commentAvatarPlaceholder}>
                    <FontAwesome5 name="user" size={16} color="#666" />
                  </View>
                )}
                <Text style={styles.commentUsername}>{comment.profile.username}</Text>
              </View>
              <Text style={styles.commentText}>{comment.comment_text}</Text>
            </BlurView>
          ))}
        </View>
      </ScrollView>

      <BlurView intensity={80} style={styles.commentInput}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!newComment.trim() || submitting) && styles.buttonDisabled]}
          onPress={handleAddComment}
          disabled={!newComment.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <FontAwesome5 name="paper-plane" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </BlurView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginTop: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: 400,
    backgroundColor: '#000',
  },
  detailsCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  questTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  caption: {
    fontSize: 16,
    color: '#000',
  },
  commentsSection: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  commentCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  commentAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentText: {
    fontSize: 16,
    color: '#000',
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
}); 