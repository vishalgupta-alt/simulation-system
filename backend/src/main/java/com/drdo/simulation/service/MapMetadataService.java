package com.drdo.simulation.service;

import com.drdo.simulation.model.MapMetadataResponse;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.channels.FileChannel;

@Service
public class MapMetadataService {

    private MapMetadataResponse metadata;

    @PostConstruct
    public void init() {
        File file = new File("C:/Users/Vishal Gupta/Downloads/NE2_HR_LC_SR_W_DR.tif");
        if (file.exists() && file.isFile()) {
            try {
                this.metadata = parseTiffFile(file);
                System.out.println("Successfully loaded GeoTIFF coordinates from: " + file.getAbsolutePath());
                System.out.printf("GeoTIFF Bounds: Lon [%f, %f], Lat [%f, %f]%n",
                        metadata.getMinLon(), metadata.getMaxLon(), metadata.getMinLat(), metadata.getMaxLat());
                return;
            } catch (Exception e) {
                System.err.println("Warning: Failed to parse GeoTIFF file, falling back to default map coordinates. Error: " + e.getMessage());
            }
        } else {
            System.out.println("Info: GeoTIFF file not found at " + file.getAbsolutePath() + ", using default map coordinates.");
        }

        // Fallback to default world map bounds (full equirectangular globe)
        this.metadata = new MapMetadataResponse(
                false,   // georeferenced
                -180.0,  // minLon
                180.0,   // maxLon
                -90.0,   // minLat
                90.0,    // maxLat
                21600,   // originalWidth
                10800    // originalHeight
        );
    }

    public MapMetadataResponse getMetadata() {
        return metadata;
    }

    private MapMetadataResponse parseTiffFile(File file) throws Exception {
        try (RandomAccessFile raf = new RandomAccessFile(file, "r");
             FileChannel channel = raf.getChannel()) {

            ByteBuffer header = ByteBuffer.allocate(8);
            header.order(ByteOrder.LITTLE_ENDIAN);
            channel.read(header);
            header.flip();

            byte b0 = header.get();
            byte b1 = header.get();
            boolean bigEndian;
            if (b0 == 'I' && b1 == 'I') {
                bigEndian = false;
            } else if (b0 == 'M' && b1 == 'M') {
                bigEndian = true;
            } else {
                throw new IllegalArgumentException("Invalid TIFF byte order sequence");
            }

            ByteOrder byteOrder = bigEndian ? ByteOrder.BIG_ENDIAN : ByteOrder.LITTLE_ENDIAN;
            header.order(byteOrder);

            int magic = header.getShort();
            if (magic != 42) {
                throw new IllegalArgumentException("Invalid TIFF magic number: " + magic);
            }

            long ifdOffset = header.getInt() & 0xFFFFFFFFL;
            channel.position(ifdOffset);

            ByteBuffer countBuf = ByteBuffer.allocate(2).order(byteOrder);
            channel.read(countBuf);
            countBuf.flip();
            int numEntries = countBuf.getShort() & 0xFFFF;

            ByteBuffer entryBuf = ByteBuffer.allocate(12 * numEntries).order(byteOrder);
            channel.read(entryBuf);
            entryBuf.flip();

            int width = 0;
            int height = 0;
            double scaleX = 0;
            double scaleY = 0;
            double modelX = -180.0;
            double modelY = 90.0;
            boolean hasPixelScale = false;
            boolean hasTiepoint = false;

            for (int i = 0; i < numEntries; i++) {
                int tag = entryBuf.getShort() & 0xFFFF;
                int type = entryBuf.getShort() & 0xFFFF;
                long count = entryBuf.getInt() & 0xFFFFFFFFL;
                long valueOffset = entryBuf.getInt() & 0xFFFFFFFFL;

                if (tag == 256) { // ImageWidth
                    width = (int) (type == 3 ? (valueOffset & 0xFFFF) : valueOffset);
                } else if (tag == 257) { // ImageHeight
                    height = (int) (type == 3 ? (valueOffset & 0xFFFF) : valueOffset);
                } else if (tag == 33550) { // ModelPixelScaleTag
                    if (type == 12 && count >= 2) {
                        long oldPos = channel.position();
                        channel.position(valueOffset);
                        ByteBuffer data = ByteBuffer.allocate((int)(count * 8)).order(byteOrder);
                        channel.read(data);
                        data.flip();
                        scaleX = data.getDouble();
                        scaleY = data.getDouble();
                        hasPixelScale = true;
                        channel.position(oldPos);
                    }
                } else if (tag == 33922) { // ModelTiepointTag
                    if (type == 12 && count >= 6) {
                        long oldPos = channel.position();
                        channel.position(valueOffset);
                        ByteBuffer data = ByteBuffer.allocate((int)(count * 8)).order(byteOrder);
                        channel.read(data);
                        data.flip();
                        // Tiepoint structure: [i, j, k, x, y, z]
                        double iPixel = data.getDouble();
                        double jPixel = data.getDouble();
                        double kPixel = data.getDouble();
                        modelX = data.getDouble();
                        modelY = data.getDouble();
                        hasTiepoint = true;
                        channel.position(oldPos);
                    }
                }
            }

            if (width > 0 && height > 0 && hasPixelScale && hasTiepoint) {
                double minLon = modelX;
                double maxLon = modelX + (width * scaleX);
                double maxLat = modelY;
                double minLat = modelY - (height * scaleY);
                return new MapMetadataResponse(true, minLon, maxLon, minLat, maxLat, width, height);
            } else {
                throw new IllegalArgumentException("TIFF does not contain required GeoTIFF tags (ModelPixelScale and ModelTiepoint)");
            }
        }
    }
}
