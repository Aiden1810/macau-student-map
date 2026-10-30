import type {Shop} from '../../types/shop';

/** Wire format for already-open older pages; all facts still come from places. */
export function toLegacyShopResponse(shop: Shop) {
  return {
    id: shop.id, name: shop.name, address: shop.address, type: shop.type,
    category: shop.category, status: shop.status, tags: shop.tags, features: shop.features,
    longitude: shop.hasCoordinates ? shop.coordinates[0] : null,
    latitude: shop.hasCoordinates ? shop.coordinates[1] : null,
    image_urls: shop.imageUrls, student_discount: shop.studentDiscount,
    shop_type: shop.shopType, rating_label: shop.ratingLabel,
    rating: shop.rating, reviews: shop.reviews, review_count: shop.reviews,
    recommend_status: shop.recommendStatus, review_text: shop.reviewText,
    main_category: shop.mainCategory, sub_tags: shop.subTags,
    price_per_person: shop.pricePerPerson, published_at: shop.publishedAt,
    region: shop.region, signature_dish: shop.signatureDish,
    sharp_review: shop.sharpReview, phone: shop.phone
  };
}
