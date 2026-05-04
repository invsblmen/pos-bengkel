<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PartCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'parent_id', 'name', 'description', 'icon', 'sort_order'
    ];

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order')->orderBy('name');
    }

    public function parts()
    {
        return $this->hasMany(Part::class);
    }

    public function getDepth(): int
    {
        $depth = 0;
        $current = $this;
        while ($current->parent_id !== null) {
            $current = $current->parent;
            $depth++;
        }
        return $depth;
    }
}
