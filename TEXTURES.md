# Texture System Documentation

This Minecraft clone now includes a flexible texture system that allows you to easily add custom textures to blocks.

## Quick Start

### Option 1: Use Default Colored Textures (Recommended)
The game now uses colored textures by default, which provide better visual distinction between different block types without requiring external texture files.

### Option 2: Add Your Own Textures

1. **Edit the texture configuration file:**
   Open `src/data/textureConfig.ts` and modify the `CUSTOM_TEXTURES` object:

   ```typescript
   export const CUSTOM_TEXTURES: Record<string, string> = {
     'GRASS': '/textures/grass_block_top.png',
     'DIRT': '/textures/dirt.png',
     'STONE': '/textures/stone.png',
     // Add more textures here
   };
   ```

2. **Place your texture files:**
   Put your texture images in the `public/textures/` folder (create it if it doesn't exist).

3. **Texture format:**
   - Use PNG format for best results
   - Recommended size: 64x64 pixels
   - Use transparent backgrounds for blocks like glass

### Option 3: Add Individual Textures Programmatically

You can also add textures at runtime:

```typescript
import { addCustomTexture } from './src/data/textureConfig';

// Add a custom texture for grass
addCustomTexture('GRASS', '/my/custom/grass_texture.png');

// Add a custom texture for stone
addCustomTexture('STONE', '/my/custom/stone_texture.png');
```

## Available Block Types

Here are some common block types you can add textures for:

- `GRASS` - Grass block
- `DIRT` - Dirt block
- `STONE` - Stone block
- `COBBLESTONE` - Cobblestone block
- `OAK_LOG` - Oak wood log
- `OAK_LEAVES` - Oak leaves
- `SAND` - Sand block
- `WATER` - Water block
- `LAVA` - Lava block
- `SNOW` - Snow block
- `IRON_ORE` - Iron ore
- `COAL_ORE` - Coal ore
- `GOLD_ORE` - Gold ore
- `DIAMOND_ORE` - Diamond ore

## Creating Your Own Textures

### Tools for Creating Textures:
- **Aseprite** - Professional pixel art editor
- **GraphicsGale** - Classic pixel art tool
- **GIMP** - Free image editor with pixel art capabilities
- **Paint.NET** - Simple image editor
- **Piskel** - Online pixel art editor

### Texture Guidelines:
- Use 64x64 pixel resolution
- Maintain consistent lighting and style
- Use transparency for blocks like glass
- Consider creating multiple variants for variety

### Example Texture Structure:
```
public/
  textures/
    blocks/
      grass_block_top.png
      grass_block_side.png
      dirt.png
      stone.png
      cobblestone.png
      oak_planks.png
      oak_log_side.png
      oak_log_top.png
      oak_leaves.png
      water_still.png
      lava_still.png
```

## Troubleshooting

### Textures Not Loading?
1. Check that the file path is correct
2. Ensure the image file exists in the specified location
3. Verify the image format is supported (PNG recommended)
4. Check the browser console for error messages

### Textures Look Blurry?
1. Make sure your textures are 64x64 pixels
2. Check that the texture filtering is set correctly (should be NearestFilter)
3. Ensure the image is not being scaled during import

### Performance Issues?
1. Use smaller texture sizes if needed
2. Consider using a texture atlas for better performance
3. Limit the number of unique textures

## Advanced Usage

### Creating a Texture Atlas
For better performance with many textures, you can create a texture atlas:

1. Create a large image containing all your textures
2. Modify the texture system to use atlas coordinates
3. Update the UV mapping in the mesh builder

### Dynamic Texture Loading
You can load textures dynamically based on the current biome or region:

```typescript
// Load different textures based on biome
if (biome === 'DESERT') {
  addCustomTexture('DIRT', '/textures/sand.png');
} else if (biome === 'SNOWY') {
  addCustomTexture('DIRT', '/textures/snow_dirt.png');
}
```

## Contributing Textures

If you create great textures, consider sharing them:

1. Create a texture pack following the structure above
2. Document the changes in a README
3. Share with the community!

## Notes

- The texture system automatically falls back to colored textures if custom textures fail to load
- Textures are cached for performance
- The system supports both individual textures and texture atlases
- All texture loading is asynchronous to prevent blocking the main thread