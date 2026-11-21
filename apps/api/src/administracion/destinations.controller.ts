// GET /destinations: the destination list the travel request form shows (UC-01 step 2).
import { Controller, Get } from '@nestjs/common';
import { DestinationCatalog } from './destination-catalog.service.js';
import { DestinationSummary } from './dto/destination.responses.js';

@Controller('destinations')
export class DestinationsController {
  constructor(private readonly destinations: DestinationCatalog) {}

  // No @Roles: any logged-in employee may read the catalog (the global guard still asks for a token).
  @Get()
  list(): Promise<DestinationSummary[]> {
    return this.destinations.list();
  }
}
