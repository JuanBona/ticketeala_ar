// HTTP endpoints of UC-01 for the employee: create a travel request and list one's own.
import { Body, Controller, Get, Post } from '@nestjs/common';
import type { AuthenticatedEmployee } from '../auth/authenticated-employee.js';
import { CurrentEmployee, Roles } from '../auth/decorators.js';
import { CreateTravelRequestRequest } from './dto/create-travel-request.request.js';
import type { TravelRequestSummary } from './travel-request-summary.js';
import { TravelRequestsService } from './travel-requests.service.js';

@Controller('travel-requests')
export class TravelRequestsController {
  constructor(private readonly travelRequests: TravelRequestsService) {}

  // UC-01's primary actor is the employee; the agency advisor (only 'agencia') cannot ask for trips.
  @Roles('empleado')
  @Post()
  create(
    @CurrentEmployee() employee: AuthenticatedEmployee,
    @Body() request: CreateTravelRequestRequest,
  ): Promise<TravelRequestSummary> {
    // The requester is always the logged-in employee, never a number sent in the body.
    return this.travelRequests.create(employee.employeeNumber, request);
  }

  @Roles('empleado')
  @Get('mine')
  listMine(
    @CurrentEmployee() employee: AuthenticatedEmployee,
  ): Promise<TravelRequestSummary[]> {
    return this.travelRequests.listMine(employee.employeeNumber);
  }
}
