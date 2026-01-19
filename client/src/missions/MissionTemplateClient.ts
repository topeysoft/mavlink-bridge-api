/**
 * Mission Template Client
 *
 * API client for mission template endpoints.
 * Templates provide pre-configured starting points for creating missions.
 */

import { HttpClient } from '../core/HttpClient';
import {
  MissionTemplate,
  MissionTemplateListResponse,
  MissionTemplateDetail,
  MissionTemplateSummary,
  TemplateCategory,
  WeatherCheckResponse,
  MissionFromTemplateRequest,
  MissionOperationResponse,
  UserMode
} from './MissionTemplateTypes';

export interface ListTemplatesOptions {
  /** Filter by category */
  category?: TemplateCategory;
  /** User mode for filtering template visibility */
  userMode?: UserMode;
  /** Include templates with missing peripherals */
  includeUnavailable?: boolean;
}

export class MissionTemplateClient {
  constructor(private httpClient: HttpClient) {}

  /**
   * List all available mission templates
   *
   * @param options Filtering options
   * @returns Template list with summaries and category info
   */
  async listTemplates(options?: ListTemplatesOptions): Promise<MissionTemplateListResponse> {
    const params = new URLSearchParams();

    if (options?.category) {
      params.append('category', options.category);
    }
    if (options?.userMode) {
      params.append('user_mode', options.userMode);
    }
    if (options?.includeUnavailable) {
      params.append('include_unavailable', 'true');
    }

    const queryString = params.toString();
    const url = queryString
      ? `/api/mission-templates?${queryString}`
      : '/api/mission-templates';

    return this.httpClient.get<MissionTemplateListResponse>(url);
  }

  /**
   * Get detailed information about a specific template
   *
   * Returns the full template definition along with current weather
   * suitability, peripheral availability, and compatible zones.
   *
   * @param templateId Template identifier
   * @returns Template detail with status information
   */
  async getTemplate(templateId: string): Promise<MissionTemplateDetail> {
    return this.httpClient.get<MissionTemplateDetail>(
      `/api/mission-templates/${templateId}`
    );
  }

  /**
   * Check if weather conditions are suitable for a template
   *
   * Returns current weather suitability and suggested alternative times
   * if conditions are not suitable.
   *
   * @param templateId Template identifier
   * @param scheduledTime Optional scheduled time to check
   * @returns Weather check response with suitability and suggestions
   */
  async checkWeather(
    templateId: string,
    scheduledTime?: Date
  ): Promise<WeatherCheckResponse> {
    let url = `/api/mission-templates/${templateId}/check-weather`;

    if (scheduledTime) {
      const params = new URLSearchParams();
      params.append('scheduled_time', scheduledTime.toISOString());
      url += `?${params.toString()}`;
    }

    return this.httpClient.post<WeatherCheckResponse>(url, {});
  }

  /**
   * Create a new mission from a template
   *
   * Creates a mission using the template's default settings with user
   * customizations applied.
   *
   * @param templateId Template identifier
   * @param request Mission creation request with customizations
   * @returns Operation response with mission ID and status
   */
  async createMissionFromTemplate(
    templateId: string,
    request: MissionFromTemplateRequest
  ): Promise<MissionOperationResponse> {
    return this.httpClient.post<MissionOperationResponse>(
      `/api/mission-templates/${templateId}/create`,
      request
    );
  }

  /**
   * Get templates by category
   *
   * Convenience method to get templates filtered by category.
   *
   * @param category Template category
   * @param userMode Optional user mode filter
   * @returns List of template summaries
   */
  async getTemplatesByCategory(
    category: TemplateCategory,
    userMode?: UserMode
  ): Promise<MissionTemplateSummary[]> {
    const response = await this.listTemplates({ category, userMode });
    return response.templates;
  }

  /**
   * Get available templates only
   *
   * Returns only templates that have all required peripherals connected.
   *
   * @param userMode Optional user mode filter
   * @returns List of available template summaries
   */
  async getAvailableTemplates(userMode?: UserMode): Promise<MissionTemplateSummary[]> {
    const response = await this.listTemplates({
      userMode,
      includeUnavailable: false
    });
    return response.templates;
  }

  /**
   * Get templates for consumer mode
   *
   * Convenience method for consumer-facing UI.
   *
   * @returns List of consumer-visible template summaries
   */
  async getConsumerTemplates(): Promise<MissionTemplateSummary[]> {
    return this.getAvailableTemplates('consumer');
  }

  /**
   * Quick check if a template is available
   *
   * @param templateId Template identifier
   * @returns True if template is available (has required peripherals)
   */
  async isTemplateAvailable(templateId: string): Promise<boolean> {
    try {
      const detail = await this.getTemplate(templateId);
      return detail.peripheral_status.all_required_available;
    } catch {
      return false;
    }
  }

  /**
   * Get weather suitability for a template
   *
   * Quick check to see if current weather is suitable.
   *
   * @param templateId Template identifier
   * @returns True if weather is suitable
   */
  async isWeatherSuitable(templateId: string): Promise<boolean> {
    try {
      const detail = await this.getTemplate(templateId);
      return detail.weather_status.suitable;
    } catch {
      return false;
    }
  }
}
