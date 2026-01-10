"""Zone type metadata and constants

Defines metadata for each zone type including default colors,
icons, display names, and consumer-friendly labels.
"""

from typing import TypedDict

from yardrover.models.resources import ZoneType


class ZoneTypeInfo(TypedDict):
    """Zone type metadata"""

    color: str  # Hex color code
    icon: str  # Emoji or icon identifier
    name: str  # Technical display name
    consumer_name: str  # Consumer-friendly display name
    description: str  # Short description
    consumer_description: str  # Consumer-friendly description
    requires_feature: str | None  # Feature flag requirement (if any)


# Zone type metadata dictionary
ZONE_TYPE_METADATA: dict[ZoneType, ZoneTypeInfo] = {
    ZoneType.MOWING: {
        "color": "#2C5F2D",  # Forest green
        "icon": "🌱",
        "name": "Mowing Zone",
        "consumer_name": "Work Area",
        "description": "Area for autonomous lawn mowing",
        "consumer_description": "Where your YardRover will mow the lawn",
        "requires_feature": None,
    },
    ZoneType.EXCLUSION: {
        "color": "#dc3545",  # Red
        "icon": "🚫",
        "name": "Exclusion Zone",
        "consumer_name": "Keep-Out Zone",
        "description": "No-go zone to avoid obstacles or restricted areas",
        "consumer_description": "Places your YardRover will stay away from",
        "requires_feature": None,
    },
    ZoneType.CHARGING: {
        "color": "#ffc107",  # Yellow/amber
        "icon": "⚡",
        "name": "Charging Station",
        "consumer_name": "Charging Spot",
        "description": "Designated charging station location",
        "consumer_description": "Where your YardRover goes to recharge",
        "requires_feature": None,
    },
    ZoneType.PATROL: {
        "color": "#17a2b8",  # Info blue
        "icon": "👁️",
        "name": "Patrol Route",
        "consumer_name": "Security Route",
        "description": "Security surveillance and perimeter monitoring zone",
        "consumer_description": "Route for keeping watch over your property",
        "requires_feature": "security_patrol",
    },
    ZoneType.SNOW_CLEARING: {
        "color": "#87CEEB",  # Sky blue
        "icon": "❄️",
        "name": "Snow Clearing Zone",
        "consumer_name": "Snow Clearing Area",
        "description": "Winter snow removal zone",
        "consumer_description": "Areas to clear when it snows",
        "requires_feature": "snow_clearing",
    },
    ZoneType.STAGING: {
        "color": "#6c757d",  # Gray
        "icon": "📦",
        "name": "Staging Area",
        "consumer_name": "Storage Spot",
        "description": "Material staging, storage, or dumping location",
        "consumer_description": "Place to drop off collected materials",
        "requires_feature": None,
    },
    ZoneType.SPRAYING: {
        "color": "#7CB342",  # Grass green
        "icon": "💧",
        "name": "Spraying Zone",
        "consumer_name": "Fertilizing Area",
        "description": "Chemical/fertilizer application zone",
        "consumer_description": "Areas to fertilize or treat",
        "requires_feature": "precision_spraying",
    },
    ZoneType.WATERING: {
        "color": "#4FC3F7",  # Light blue
        "icon": "💦",
        "name": "Watering Zone",
        "consumer_name": "Watering Area",
        "description": "Irrigation and watering zone",
        "consumer_description": "Places that need regular watering",
        "requires_feature": "irrigation",
    },
    ZoneType.COLLECTION: {
        "color": "#8D6E63",  # Brown
        "icon": "🍂",
        "name": "Collection Zone",
        "consumer_name": "Cleanup Area",
        "description": "Debris and leaf collection zone",
        "consumer_description": "Areas to clean up leaves and debris",
        "requires_feature": "debris_collection",
    },
    ZoneType.MONITORING: {
        "color": "#9C27B0",  # Purple
        "icon": "📊",
        "name": "Monitoring Zone",
        "consumer_name": "Sensor Area",
        "description": "Environmental monitoring and data collection zone",
        "consumer_description": "Places to check temperature, humidity, and conditions",
        "requires_feature": "environmental_monitoring",
    },
}


def get_zone_type_color(zone_type: ZoneType) -> str:
    """Get default color for a zone type

    Args:
        zone_type: Zone type

    Returns:
        Hex color code (e.g., "#2C5F2D")
    """
    return ZONE_TYPE_METADATA[zone_type]["color"]


def get_zone_type_icon(zone_type: ZoneType) -> str:
    """Get icon for a zone type

    Args:
        zone_type: Zone type

    Returns:
        Icon string (emoji or identifier)
    """
    return ZONE_TYPE_METADATA[zone_type]["icon"]


def get_zone_type_name(zone_type: ZoneType, consumer_mode: bool = False) -> str:
    """Get display name for a zone type

    Args:
        zone_type: Zone type
        consumer_mode: Use consumer-friendly name if True

    Returns:
        Display name string
    """
    metadata = ZONE_TYPE_METADATA[zone_type]
    return metadata["consumer_name"] if consumer_mode else metadata["name"]


def get_zone_type_description(zone_type: ZoneType, consumer_mode: bool = False) -> str:
    """Get description for a zone type

    Args:
        zone_type: Zone type
        consumer_mode: Use consumer-friendly description if True

    Returns:
        Description string
    """
    metadata = ZONE_TYPE_METADATA[zone_type]
    return metadata["consumer_description"] if consumer_mode else metadata["description"]


def get_required_feature(zone_type: ZoneType) -> str | None:
    """Get required feature flag for a zone type

    Args:
        zone_type: Zone type

    Returns:
        Feature flag name or None if no requirement
    """
    return ZONE_TYPE_METADATA[zone_type]["requires_feature"]


def is_zone_type_available(zone_type: ZoneType, enabled_features: set[str]) -> bool:
    """Check if a zone type is available based on enabled features

    Args:
        zone_type: Zone type to check
        enabled_features: Set of enabled feature flag names

    Returns:
        True if zone type is available, False otherwise
    """
    required_feature = get_required_feature(zone_type)
    if required_feature is None:
        return True
    return required_feature in enabled_features
