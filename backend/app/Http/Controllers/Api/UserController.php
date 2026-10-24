<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;

class UserController extends Controller
{
    /** GET /api/me */
    public function me(): UserResource
    {
        return new UserResource(User::findOrFail(config('chat.self_user_id')));
    }
}
