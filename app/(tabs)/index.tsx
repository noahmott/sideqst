import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Image
} from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { questService } from '../../lib/services/questService';
import type { Quest, QuestFilters, Category } from '../../lib/types/quest';

const CATEGORIES = [
  'Adventure',
  'Food',
  'Art',
  'Nature',
  'Culture',
  'Fitness',
  'Social'
];

export default function DiscoverScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showDaily, setShowDaily] = useState<boolean | undefined>(undefined);
  const [showGeofenced, setShowGeofenced] = useState<boolean | undefined>(undefined);
  const [allCategoriesSelected, setAllCategoriesSelected] = useState(true);

  const fetchData = async (filters?: QuestFilters) => {
    try {
      setLoading(true);
      // Fetch categories first
      console.log('Fetching categories...');
      const categoriesData = await questService.fetchCategories();
      console.log('Categories fetched:', categoriesData);
      setCategories(categoriesData);

      // If "All Categories" is not selected and no specific categories are selected, return no quests
      if (!allCategoriesSelected && (!filters?.categories || filters.categories.length === 0)) {
        console.log('No categories selected, returning empty quest list');
        setQuests([]);
        return;
      }

      // Then fetch quests with filters
      console.log('Fetching quests with filters:', filters);
      const questsData = await questService.fetchQuests(filters);
      console.log('Quests fetched:', questsData);
      setQuests(questsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const filters: QuestFilters = {
      searchQuery: searchQuery || undefined,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      isDaily: showDaily,
      isGeofenced: showGeofenced,
    };
    fetchData(filters);
  }, [searchQuery, selectedCategories, showDaily, showGeofenced]);

  const onRefresh = () => {
    setRefreshing(true);
    const filters: QuestFilters = {
      searchQuery: searchQuery || undefined,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      isDaily: showDaily,
      isGeofenced: showGeofenced,
    };
    fetchData(filters);
  };

  const toggleAllCategories = () => {
    if (allCategoriesSelected) {
      setAllCategoriesSelected(false);
      setSelectedCategories([]);
    } else {
      setAllCategoriesSelected(true);
      setSelectedCategories([]);
    }
    setShowCategoryDropdown(false);
  };

  const toggleCategory = (categoryId: string) => {
    setAllCategoriesSelected(false);
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const renderQuestCard = ({ item }: { item: Quest }) => (
    <TouchableOpacity 
      style={[
        styles.questCard,
        { borderLeftColor: item.category?.color || '#007AFF' }
      ]}
      onPress={() => router.push({
        pathname: '/quest/[id]',
        params: { id: item.id }
      })}
    >
      <View style={[styles.questCardBackground]}>
        {item.category?.image_url && (
          <Image 
            source={{ uri: item.category.image_url }} 
            style={styles.questCardImage}
            resizeMode="cover"
          />
        )}
        <View style={styles.darkOverlay} />
      </View>
      <View style={styles.questCardContent}>
        <View style={styles.questHeader}>
          <View style={styles.questInfo}>
            <View style={styles.categoryContainer}>
              {item.category?.icon && (
                <FontAwesome5 
                  name={item.category.icon} 
                  size={14} 
                  color="#fff"
                  style={styles.categoryIcon}
                />
              )}
              <Text style={[styles.questCategory, { color: '#fff' }]}>
                {item.category?.name || 'Unknown'}
              </Text>
            </View>
            <Text style={styles.questTitle}>{item.title}</Text>
            <Text style={styles.questDescription} numberOfLines={2}>
              {item.short_description}
            </Text>
          </View>
          <View style={styles.questBadges}>
            {item.is_daily && (
              <View style={[styles.badge, styles.dailyBadge]}>
                <FontAwesome5 name="clock" size={12} color="#fff" />
                <Text style={styles.badgeText}>Daily</Text>
              </View>
            )}
            {item.is_geofenced && (
              <View style={[styles.badge, styles.geoBadge]}>
                <FontAwesome5 name="map-marker-alt" size={12} color="#fff" />
                <Text style={styles.badgeText}>Location</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.questFooter}>
          <View style={styles.questStats}>
            <View style={styles.questStat}>
              <FontAwesome5 name="star" size={12} color="#FFB800" />
              <Text style={[styles.questStatText, { color: '#fff' }]}>{item.base_xp_reward} XP</Text>
            </View>
            <View style={styles.questStat}>
              <FontAwesome5 name="tasks" size={12} color="#fff" />
              <Text style={[styles.questStatText, { color: '#fff' }]}>3 steps</Text>
            </View>
          </View>
          <FontAwesome5 name="chevron-right" size={16} color="#fff" />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCategoryDropdown = () => (
    showCategoryDropdown && (
      <>
        <TouchableOpacity 
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryDropdown(false)}
        />
        <BlurView 
          intensity={90} 
          style={styles.dropdownContainer}
        >
          <ScrollView style={styles.dropdownList}>
            <TouchableOpacity
              style={[
                styles.dropdownItem,
                allCategoriesSelected && styles.dropdownItemSelected
              ]}
              onPress={toggleAllCategories}
            >
              <View style={styles.dropdownItemContent}>
                <FontAwesome5 
                  name="globe" 
                  size={16} 
                  color={allCategoriesSelected ? '#fff' : '#666'} 
                  style={styles.dropdownIcon}
                />
                <Text 
                  style={[
                    styles.dropdownItemText,
                    allCategoriesSelected && styles.dropdownItemTextSelected
                  ]}
                >
                  All Categories
                </Text>
              </View>
              <FontAwesome5 
                name={allCategoriesSelected ? 'check-circle' : 'circle'} 
                size={16} 
                color={allCategoriesSelected ? '#fff' : '#ccc'} 
              />
            </TouchableOpacity>

            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.dropdownItem,
                  selectedCategories.includes(category.id) && styles.dropdownItemSelected
                ]}
                onPress={() => toggleCategory(category.id)}
              >
                <View style={styles.dropdownItemContent}>
                  {category.icon && (
                    <FontAwesome5 
                      name={category.icon} 
                      size={16} 
                      color={selectedCategories.includes(category.id) ? '#fff' : '#666'} 
                      style={styles.dropdownIcon}
                    />
                  )}
                  <Text 
                    style={[
                      styles.dropdownItemText,
                      selectedCategories.includes(category.id) && styles.dropdownItemTextSelected
                    ]}
                  >
                    {category.name}
                  </Text>
                </View>
                <FontAwesome5 
                  name={selectedCategories.includes(category.id) ? 'check-circle' : 'circle'} 
                  size={16} 
                  color={selectedCategories.includes(category.id) ? '#fff' : '#ccc'} 
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </BlurView>
      </>
    )
  );

  // Update the category button text display
  const getCategoryButtonText = () => {
    if (allCategoriesSelected) return 'All Categories';
    if (selectedCategories.length === 0) return 'No Categories';
    return `${selectedCategories.length} Selected`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.searchContainer}>
          <FontAwesome5 name="search" size={16} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search quests..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <View style={styles.categoryButtonContainer}>
          <TouchableOpacity
            style={[
              styles.categoryButton,
              showCategoryDropdown && styles.categoryButtonActive
            ]}
            onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
          >
            <FontAwesome5 name="tags" size={14} color="#666" />
            <Text style={styles.categoryButtonText}>
              {getCategoryButtonText()}
            </Text>
            <FontAwesome5 
              name={showCategoryDropdown ? "chevron-up" : "chevron-down"} 
              size={12} 
              color="#666" 
            />
          </TouchableOpacity>
          {renderCategoryDropdown()}
        </View>

        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, showDaily && styles.filterButtonActive]}
            onPress={() => setShowDaily(showDaily === undefined ? true : undefined)}
          >
            <FontAwesome5 
              name="clock" 
              size={12} 
              color={showDaily ? "#fff" : "#666"} 
            />
            <Text 
              style={[styles.filterText, showDaily && styles.filterTextActive]}
            >
              Daily
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, showGeofenced && styles.filterButtonActive]}
            onPress={() => setShowGeofenced(showGeofenced === undefined ? true : undefined)}
          >
            <FontAwesome5 
              name="map-marker-alt" 
              size={12} 
              color={showGeofenced ? "#fff" : "#666"} 
            />
            <Text 
              style={[styles.filterText, showGeofenced && styles.filterTextActive]}
            >
              Nearby
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={quests}
          renderItem={renderQuestCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.questList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <FontAwesome5 name="scroll" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No quests found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  categoryButtonContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  categoryButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#fff',
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  questList: {
    padding: 16,
  },
  questCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    height: 200,
    backgroundColor: '#fff',
    borderLeftWidth: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  questCardBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1a1a',
  },
  questCardImage: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  questCardContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  questHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  questInfo: {
    flex: 1,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryIcon: {
    marginRight: 6,
  },
  questCategory: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  questTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#fff',
  },
  questDescription: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    opacity: 0.9,
  },
  questBadges: {
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  dailyBadge: {
    backgroundColor: '#007AFF',
  },
  geoBadge: {
    backgroundColor: '#34C759',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  questFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  questStats: {
    flexDirection: 'row',
    gap: 16,
  },
  questStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  questStatText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  dropdownOverlay: {
    position: 'absolute',
    top: -60, // to cover from top of screen
    left: -20, // to cover from left edge
    right: -20, // to cover to right edge
    bottom: -1000, // to cover full screen
    backgroundColor: 'transparent',
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    maxHeight: 300,
    zIndex: 1001,
  },
  dropdownList: {
    padding: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  dropdownItemSelected: {
    backgroundColor: '#007AFF',
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownIcon: {
    marginRight: 8,
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#000',
  },
  dropdownItemTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  categoryButtonActive: {
    backgroundColor: '#E5E5EA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
});
