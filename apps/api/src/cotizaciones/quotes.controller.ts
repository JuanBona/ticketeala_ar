// HTTP endpoints of quotes: the agency loads them (UC-03), the requester compares and selects (UC-01 8–9).
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { AuthenticatedEmployee } from '../auth/authenticated-employee.js';
import { CurrentEmployee, Roles } from '../auth/decorators.js';
import { AddQuoteRequest } from './dto/add-quote.request.js';
import { SelectQuoteRequest } from './dto/select-quote.request.js';
import { QuoteComparison, QuoteView } from './dto/quote.responses.js';
import { QuotesService } from './quotes.service.js';

@Controller('travel-requests/:travelRequestId')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  // ParseIntPipe: the id in the URL arrives as text; a non-number answers 400.
  @Roles('agencia')
  @Post('quotes')
  add(
    @CurrentEmployee() advisor: AuthenticatedEmployee,
    @Param('travelRequestId', ParseIntPipe) travelRequestId: number,
    @Body() request: AddQuoteRequest,
  ): Promise<QuoteView> {
    return this.quotes.add(advisor.employeeNumber, travelRequestId, request);
  }

  @Roles('empleado')
  @Get('quotes')
  compare(
    @CurrentEmployee() employee: AuthenticatedEmployee,
    @Param('travelRequestId', ParseIntPipe) travelRequestId: number,
  ): Promise<QuoteComparison> {
    return this.quotes.compare(employee.employeeNumber, travelRequestId);
  }

  @Roles('empleado')
  @ApiUnprocessableEntityResponse({
    description:
      'Cotización vencida (RN11), o `code: OVER_CAP_JUSTIFICATION_REQUIRED`: supera el tope y falta overCapJustification (UC-01 9a).',
  })
  @Post('selection')
  select(
    @CurrentEmployee() employee: AuthenticatedEmployee,
    @Param('travelRequestId', ParseIntPipe) travelRequestId: number,
    @Body() request: SelectQuoteRequest,
  ): Promise<QuoteComparison> {
    return this.quotes.select(
      employee.employeeNumber,
      travelRequestId,
      request,
    );
  }
}
