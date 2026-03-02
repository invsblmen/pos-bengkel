<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BusinessProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'business_name',
        'business_phone',
        'business_address',
        'facebook',
        'instagram',
        'tiktok',
        'google_my_business',
        'website',
    ];
}
