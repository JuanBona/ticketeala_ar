// HTTP endpoint of UC-02 for the employee: upload a receipt photo (steps 1 to 3).
import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiPayloadTooLargeResponse,
  ApiUnprocessableEntityResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import type { AuthenticatedEmployee } from '../auth/authenticated-employee.js';
import { CurrentEmployee, Roles } from '../auth/decorators.js';
import { ReceiptUploadResponse } from './dto/receipt-upload.responses.js';
import { UploadReceiptRequest } from './dto/upload-receipt.request.js';
import { MAXIMUM_IMAGE_BYTES } from './receipt-image-rules.js';
import { ReceiptUploadService } from './receipt-upload.service.js';

const IMAGE_PART_NAME = 'image';

@Controller('expenses')
export class ReceiptsController {
  constructor(private readonly receiptUploads: ReceiptUploadService) {}

  // UC-02's primary actor is the employee; the file is capped by multer before it reaches the service.
  @Roles('empleado')
  @ApiConsumes('multipart/form-data')
  @ApiForbiddenResponse({ description: 'La solicitud no es del empleado.' })
  @ApiUnprocessableEntityResponse({
    description: 'La solicitud no está aprobada (UC-02, precondición).',
  })
  @ApiConflictResponse({
    description:
      'La rendición ya no admite comprobantes (presentada o aprobada).',
  })
  @ApiUnsupportedMediaTypeResponse({
    description: 'El archivo no es una foto JPEG o PNG.',
  })
  @ApiPayloadTooLargeResponse({ description: 'La foto pesa más de 10 MB.' })
  @UseInterceptors(
    FileInterceptor(IMAGE_PART_NAME, {
      limits: { fileSize: MAXIMUM_IMAGE_BYTES },
    }),
  )
  @Post()
  upload(
    @CurrentEmployee() employee: AuthenticatedEmployee,
    @Body() request: UploadReceiptRequest,
    @UploadedFile() image: Express.Multer.File | undefined,
  ): Promise<ReceiptUploadResponse> {
    // The uploader is always the logged-in employee, never a number sent in the body.
    return this.receiptUploads.upload(employee.employeeNumber, request, image);
  }
}
