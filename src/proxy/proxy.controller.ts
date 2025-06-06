import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';

import { get } from 'https';
import { FastifyReply } from 'fastify';
import axios from 'axios';

@Controller('proxy')
export class ProxyController {
  @Get('image')
  async proxyImage(
    @Query('url') imageUrl: string,
    @Res() res: FastifyReply,
  ): Promise<void> {
    try {
      // Validate URL
      const parsedUrl = new URL(imageUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new HttpException(
          'Only HTTP/HTTPS protocols are allowed',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Make request to source image using axios
      const response = await axios.get(imageUrl, {
        responseType: 'stream',
        timeout: 10000,
        // validateStatus: (status) => status === 200,
      });

      // Check if response is an image
      const contentType = response.headers['content-type'];
      if (!contentType?.startsWith('image/')) {
        throw new HttpException(
          'URL does not point to an image',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Set appropriate headers
      res.headers({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': response.headers['content-length'],
      });
      return res.send(response.data);

      // Pipe the image stream to response
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new HttpException(
            'Request timeout',
            HttpStatus.GATEWAY_TIMEOUT,
          );
        }
        throw new HttpException(
          `Failed to fetch image: ${error.message}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
